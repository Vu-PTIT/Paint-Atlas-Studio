import { useState } from 'react';
import { ArrowUpRight, Check, CircleAlert, Clock3, Plus } from 'lucide-react';
import { api } from '../api/client';
import type { Job, Project } from '../api/types';
import { go } from '../navigation';

const actionLabels: Record<string, string> = {
  analyze: 'Đọc tranh', generate: 'Dựng bằng Codex', sample: 'Dựng từ mẫu', import: 'Dựng từ mã',
};
const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' });
const stopped = (job: Job) => job.status === 'failed' || job.status === 'interrupted';

export function Jobs({ jobs, refresh, projects }: {
  jobs: Job[];
  projects: Project[];
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');

  async function action(job: Job, apply: boolean) {
    setPending(job.id);
    setError('');
    try {
      if (apply) {
        const project = projects.find(item => item.id === job.project);
        if (!project || !job.result) throw Error('Chưa tìm thấy bản nháp.');
        if (job.draft_revision !== project.revision) {
          throw Error('Bản nháp đã đổi sau khi phân tích. Mở bản nháp để đọc lại tranh hiện tại.');
        }
        await api('/projects/' + project.id, 'PUT', {
          revision: project.revision,
          draft: {
            ...project.draft,
            style: job.result.style,
            palette: job.result.palette,
            subject_notes: project.draft.mode === 'subject' ? job.result.subject_notes : '',
          },
        });
        await refresh();
        go('draft', project.id);
      } else {
        await api('/jobs/' + job.id + '/retry', 'POST');
        await refresh();
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending('');
    }
  }

  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <h1>Lượt dựng</h1>
          <p>Tiến độ phân tích tranh, tạo cảnh và kiểm tra bản dựng.</p>
        </div>
      </header>
      {error && <p role="alert" className="error">{error}</p>}
      {jobs.length ? (
        <div className="jobs">
          {jobs.map(job => {
            const version = job.result?.version;
            const Icon = job.status === 'done' ? Check : stopped(job) ? CircleAlert : Clock3;
            return (
              <article key={job.id}>
                <i className={'job-icon ' + job.status}><Icon /></i>
                <div className="job-body">
                  <span>{actionLabels[job.action]} · {dateFormat.format(new Date(job.created))}</span>
                  <h3>{job.title}</h3>
                  <p>{job.stage}</p>
                  {job.error && <details><summary>Chi tiết lỗi</summary><pre>{job.error}</pre></details>}
                </div>
                {version ? (
                  <button className="light-btn" onClick={() => go('view', job.project, version, 'edit')}>
                    Mở cảnh<ArrowUpRight size={14} />
                  </button>
                ) : job.result?.style ? (
                  <button className="light-btn" disabled={!!pending} onClick={() => action(job, true)}>Dùng kết quả</button>
                ) : stopped(job) ? (
                  <button className="light-btn" disabled={!!pending} onClick={() => action(job, false)}>Thử lại</button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <Clock3 /><h3>Chưa có lượt dựng</h3>
          <p>Khi bạn đọc tranh hoặc dựng cảnh, tiến độ sẽ xuất hiện ở đây.</p>
          <button className="primary" onClick={() => go('new')}><Plus size={15} />Tạo thế giới</button>
        </div>
      )}
    </main>
  );
}
