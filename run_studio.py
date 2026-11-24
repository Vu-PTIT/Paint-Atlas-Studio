"""Start the local editor. The bundled example worlds work without Node or Cargo."""
import argparse
import os
from pathlib import Path
from threading import Timer
import webbrowser
import uvicorn

ROOT = Path(__file__).resolve().parent
def main():
    parser = argparse.ArgumentParser(description="Paint Atlas Studio")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--open", action="store_true")
    options = parser.parse_args()
    os.chdir(ROOT)
    if not 1 <= options.port <= 65535:
        parser.error("Port must be in the range 1–65535.")
    url = f"http://127.0.0.1:{options.port}"
    print(f"Paint Atlas Studio: {url}", flush=True)
    if options.open:
        Timer(1.4, webbrowser.open, args=(url,)).start()
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=options.port)

if __name__ == "__main__":
    main()
