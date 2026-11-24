import { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, FilePenLine, FolderOpen, Paintbrush, Play, Plus, Search, SlidersHorizontal,
} from 'lucide-react';
import type { Project } from '../api/types';
import { go } from '../navigation';

const sampleOrder: Record<string, number> = { starry: 0, hoian: 1, portrait: 2 };

function WorldCard({ project }: { project: Project }) {
  const { id, draft, versions } = project;
  const latest = versions[0];
  const open = () => latest ? go('view', id, latest.id, 'edit') : go('draft', id);

  return (
    <article className="world-card">
      <button className="thumb" onClick={open} aria-label={'Mở ' + draft.title}>
        {latest ? <img src={'/api/versions/' + latest.id + '/frame'} alt={draft.title} loading="lazy" />
          : <span><Paintbrush size={28} />Bản nháp</span>}
        <i><ArrowUpRight size={17} /></i>
      </button>
      <div className="card-info">
        <span>
          {draft.mode === 'subject' ? 'Chủ thể từ tranh' : 'Phong cảnh'}
          <span className="small-dot" />
          {latest ? versions.length + ' bản dựng' : 'Bản nháp'}
        </span>
        <button onClick={open}><h3>{draft.title}</h3></button>
        <div className="card-foot">
          <span className="colorstrip" aria-label="Bảng màu">
            {draft.palette.map((color, index) => <i key={index} style={{ background: color }} />)}
          </span>
          <button title="Sửa bản nháp" aria-label={'Sửa bản nháp ' + draft.title} onClick={() => go('draft', id)}>
            <FilePenLine size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function Gallery({ projects, home }: { projects: Project[]; home: boolean }) {
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState('all');
  const sorted = home ? [...projects].sort((a, b) => (sampleOrder[a.id] ?? 3) - (sampleOrder[b.id] ?? 3)) : projects;
  const search = filter.toLocaleLowerCase('vi');
  const visible = sorted.filter(project => {
    const matchesKind = kind === 'all' || (kind === 'draft' ? !project.versions.length : project.draft.mode === kind);
    return matchesKind && project.draft.title.toLocaleLowerCase('vi').includes(search);
  });
  const hero = sorted.find(project => project.versions.length);

  function clearOrCreate() {
    if (!projects.length) {
      go('new');
      return;
    }
    setFilter('');
    setKind('all');
  }

  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <h1>{home ? 'Xưởng vẽ' : 'Thế giới của tôi'}</h1>
          <p>{home ? 'Tạo thế giới 3D từ tranh của bạn.' : 'Mở cảnh để chơi, chỉnh vật thể hoặc tiếp tục từ một bản nháp.'}</p>
        </div>
        <button className="primary" onClick={() => go('new')}><Plus size={17} />Tạo thế giới</button>
      </header>
      {home && hero && (
        <section className="hero">
          <img src={'/api/versions/' + hero.versions[0].id + '/frame'} alt={hero.draft.title} />
          <div className="hero-copy">
            <span className="eyeline"><i />CẢNH MẪU</span>
            <h2>{hero.draft.title}</h2>
            <p>{hero.id === 'starry' ? 'Cưỡi ngựa qua đồng hướng dương và ngôi làng dưới bầu trời đầy sao.' : hero.draft.world}</p>
            <div>
              <button onClick={() => go('view', hero.id, hero.versions[0].id, 'play')}>
                <Play size={15} fill="currentColor" />Vào thế giới
              </button>
              <button className="hero-ghost" onClick={() => go('view', hero.id, hero.versions[0].id, 'edit')}>
                <SlidersHorizontal size={15} />Chỉnh sửa
              </button>
            </div>
          </div>
        </section>
      )}
      <div className="gallery-head">
        <h2>{home ? 'Thế giới trong xưởng' : 'Tất cả dự án'} <small>{projects.length}</small></h2>
        {home ? (
          <button className="link-btn" onClick={() => go('worlds')}>Xem tất cả <ArrowRight size={15} /></button>
        ) : (
          <div className="filters">
            <label className="search">
              <Search size={15} />
              <input placeholder="Tìm thế giới…" value={filter} onChange={event => setFilter(event.target.value)} />
            </label>
            <select aria-label="Loại dự án" value={kind} onChange={event => setKind(event.target.value)}>
              <option value="all">Tất cả</option>
              <option value="style">Phong cảnh</option>
              <option value="subject">Có chủ thể</option>
              <option value="draft">Bản nháp</option>
            </select>
          </div>
        )}
      </div>
      <div className="cards">
        {(home ? visible.slice(0, 3) : visible).map(project => <WorldCard key={project.id} project={project} />)}
      </div>
      {!visible.length && (
        <div className="empty">
          <FolderOpen />
          <h3>{projects.length ? 'Không tìm thấy thế giới' : 'Xưởng chưa có thế giới'}</h3>
          <button className="light-btn" onClick={clearOrCreate}>{projects.length ? 'Xóa bộ lọc' : 'Tạo thế giới'}</button>
        </div>
      )}
    </main>
  );
}
