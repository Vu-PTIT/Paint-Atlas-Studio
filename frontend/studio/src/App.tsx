import { useCallback, useEffect, useState } from 'react';
import { Clock3, Globe2, Layers3, Menu, PanelTop } from 'lucide-react';
import { api } from './api/client';
import type { Job, Project } from './api/types';
import { go, readRoute } from './navigation';
import { Gallery } from './pages/Gallery';
import { Jobs } from './pages/Jobs';
import { Viewer } from './pages/Viewer';
import { Wizard } from './pages/Wizard';

const navItems = [
  { id: 'home', name: 'Xưởng vẽ', Icon: PanelTop },
  { id: 'worlds', name: 'Thế giới của tôi', Icon: Globe2 },
  { id: 'jobs', name: 'Lượt dựng', Icon: Clock3 },
];

function Brand() {
  return (
    <div className="brand">
      <i><Layers3 size={24} strokeWidth={1.6} /></i>
      <span>Paint Atlas<small>STUDIO</small></span>
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [cli, setCli] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const [page = 'home', projectId, versionId, mode] = route;

  const refresh = useCallback(async () => {
    const [updatedProjects, updatedJobs] = await Promise.all([api<Project[]>('/projects'), api<Job[]>('/jobs')]);
    setProjects(updatedProjects);
    setJobs(updatedJobs);
    setLoaded(true);
    setError('');
  }, []);

  useEffect(() => {
    const navigate = () => {
      setRoute(readRoute());
      setMobile(false);
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', navigate);
    return () => removeEventListener('hashchange', navigate);
  }, []);

  useEffect(() => {
    refresh().catch(error => setError(error.message));
    api<{ codex: boolean }>('/status').then(status => setCli(status.codex)).catch(() => setCli(null));
  }, [refresh]);

  useEffect(() => {
    if (page !== 'jobs') return;
    const timer = setInterval(() => refresh().catch(error => setError(error.message)), 2000);
    return () => clearInterval(timer);
  }, [page, refresh]);

  function navigate(page: string) {
    void refresh().catch(error => setError(error.message));
    go(page);
    setMobile(false);
  }

  const back = () => navigate('home');
  const project = projects.find(item => item.id === projectId);
  const version = project?.versions.find(item => item.id === versionId);
  if (page === 'view' && project && version) {
    return (
      <Viewer
        key={version.id + mode}
        project={project}
        version={version}
        mode={mode === 'edit' ? 'edit' : 'play'}
        back={back}
        select={id => go('view', project.id, id, mode || 'edit')}
      />
    );
  }

  const invalid = page === 'view' || (page === 'draft' && !project);
  const nav = page === 'draft' || page === 'new' ? 'home' : page;
  const running = jobs.filter(job => job.status === 'running' || job.status === 'queued').length;
  return (
    <div className="layout">
      <header className="mobile-head">
        <button aria-label="Mở điều hướng" onClick={() => setMobile(!mobile)}><Menu /></button><Brand />
      </header>
      {mobile && <button className="shade" aria-label="Đóng điều hướng" onClick={() => setMobile(false)} />}
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <button className="brand-btn" onClick={back}><Brand /></button>
        <nav>
          {navItems.map(({ id, name, Icon }) => (
            <button key={id} className={id === nav ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon size={18} />{name}{id === 'jobs' && running > 0 && <small>{running}</small>}
            </button>
          ))}
        </nav>
        <div className="cli">
          <i className={cli ? 'online' : ''} />
          <div><b>Codex CLI</b><span>{cli === null ? 'Đang kiểm tra' : cli ? 'Đã cài trên máy' : 'Chưa tìm thấy trên máy'}</span></div>
        </div>
      </aside>
      <div className="content">
        {error && <div className="error top-error">{error} <button onClick={() => refresh().catch(error => setError(error.message))}>Tải lại</button></div>}
        {!loaded ? (
          <main className="page"><p>Đang mở xưởng…</p></main>
        ) : invalid ? (
          <main className="page"><h1>Chưa tìm thấy dự án</h1><button className="light-btn" onClick={back}>Về xưởng</button></main>
        ) : page === 'new' || page === 'draft' ? (
          <Wizard
            key={projectId || 'new'} project={project} back={back} refresh={refresh}
            onJobs={() => go('jobs')} onView={(id, built) => go('view', id, built, 'edit')}
          />
        ) : page === 'jobs' ? (
          <Jobs jobs={jobs} projects={projects} refresh={refresh} />
        ) : (
          <Gallery key={page} projects={projects} home={page !== 'worlds'} />
        )}
      </div>
    </div>
  );
}
