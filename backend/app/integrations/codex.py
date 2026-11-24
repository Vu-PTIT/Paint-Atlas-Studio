"""Transport for the local, ChatGPT-authenticated Codex App Server."""
import asyncio
import json
import os
from pathlib import Path
import shutil


class CodexError(RuntimeError):
    pass


async def run_codex(prompt, images, schema, cwd: Path, progress, timeout=900):
    binary = os.environ.get("ATLAS_CODEX_BIN") or shutil.which("codex")
    if not binary:
        raise CodexError("Chưa tìm thấy Codex CLI. Cài Codex và đăng nhập ChatGPT, hoặc nhập mã cảnh từ cuộc trò chuyện.")
    env = {k: v for k, v in os.environ.items() if k not in {"OPENAI_API_KEY", "CODEX_API_KEY"}}
    command = [binary, "app-server"]
    if state_dir := os.environ.get("ATLAS_CODEX_STATE"):
        state_dir = Path(state_dir).resolve()
        state_dir.mkdir(parents=True, exist_ok=True)
        command.extend(["-c", "sqlite_home=" + json.dumps(str(state_dir)), "-c", "log_dir=" + json.dumps(str(state_dir))])
    process = await asyncio.create_subprocess_exec(
        *command, cwd=cwd, env=env,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL, limit=8 * 1024 * 1024,
    )
    sequence = 0
    final_messages = []
    completed_turn = None

    async def send(message):
        process.stdin.write((json.dumps(message, ensure_ascii=False) + "\n").encode())
        await process.stdin.drain()

    async def receive():
        nonlocal completed_turn
        while True:
            line = await process.stdout.readline()
            if not line:
                raise CodexError("Codex đóng kết nối. Kiểm tra codex login status và phiên bản CLI.")
            try:
                msg = json.loads(line)
            except (ValueError, UnicodeDecodeError):
                continue
            if "method" in msg and "id" in msg:
                # This bridge requests final text only. Decline any interactive tool action.
                method = msg["method"]
                if method.endswith("requestApproval"):
                    await send({"id":msg["id"], "result":{"decision":"decline"}})
                else:
                    await send({"id":msg["id"],"error":{"code":-32601,"message":"Interactive request unavailable"}})
                continue
            params = msg.get("params", {})
            if msg.get("method") == "item/completed":
                item = params.get("item", {})
                if item.get("type") == "agentMessage" and isinstance(item.get("text"), str):
                    final_messages.append(item["text"])
            if msg.get("method") == "turn/completed":
                completed_turn = params.get("turn", {})
            return msg

    async def call(method, params):
        nonlocal sequence
        sequence += 1
        key = sequence
        await send({"id":key,"method":method,"params":params})
        while True:
            event = await receive()
            if event.get("id") == key:
                if event.get("error"):
                    raise CodexError(str(event["error"].get("message", "Codex báo lỗi."))[:900])
                return event.get("result", {})

    try:
        async with asyncio.timeout(timeout):
            await call("initialize", {"clientInfo":{"name":"paint_atlas","title":"Paint Atlas Studio","version":"1.0.0"}})
            await send({"method":"initialized","params":{}})
            account = await call("account/read", {"refreshToken":False})
            if (account.get("account") or {}).get("type") not in {"chatgpt", "chatgptAuthTokens"}:
                raise CodexError("Cần đăng nhập ChatGPT bằng codex login trên máy đang chạy Studio.")
            thread = await call("thread/start", {"cwd":str(cwd), "sandbox":"read-only","approvalPolicy":"never","ephemeral":True})
            thread_id = thread["thread"]["id"]
            inputs = [{"type":"text","text":prompt}]
            inputs += [{"type":"localImage","path":str(Path(image).resolve())} for image in images]
            turn = await call("turn/start", {"threadId":thread_id, "input":inputs, "outputSchema":schema})
            turn_id = turn["turn"]["id"]
            progress("Codex đang xử lý", thread_id, turn_id)
            while completed_turn is None or completed_turn.get("id") != turn_id:
                await receive()
            if completed_turn.get("status") != "completed":
                detail = (completed_turn.get("error") or {}).get("message") or completed_turn.get("status")
                raise CodexError(f"Codex chưa hoàn thành lượt dựng. {str(detail)[:800]}")
            for message in reversed(final_messages):
                try:
                    return json.loads(message)
                except ValueError:
                    continue
            raise CodexError("Codex chưa trả kết quả JSON theo cấu trúc của Studio.")
    except TimeoutError as exc:
        raise CodexError("Lượt Codex đã hết thời gian chờ. Có thể thử lại từ cùng bản nháp.") from exc
    finally:
        if process.returncode is None:
            try:
                process.stdin.close()
                await asyncio.wait_for(process.wait(), 2)
            except (TimeoutError, BrokenPipeError, ConnectionResetError):
                if process.returncode is None:
                    try:
                        process.kill()
                    except ProcessLookupError:
                        pass
                    await process.wait()
