import type { FullDraft } from './api/types';

export const samples = {
  sky: {
    id: 'sample-sky', title: 'Đêm đầy sao', source: 'landscape.webp',
    palette: ['#142141', '#315388', '#7399a4', '#e5ad57', '#e9d7b2'],
    style: 'Nét sơn dầu dày chạy thành những dải xoáy. Xanh cobalt và lam ngọc trong vùng tối, điểm sáng vàng mật.',
  },
  portrait: {
    id: 'sample-portrait', title: 'Chân dung người làm đèn', source: 'portrait.webp',
    palette: ['#103332', '#32675e', '#aa352a', '#edaa59', '#f4dbab'],
    style: 'Bề mặt sơn dày với nét ngắn đổi hướng theo khối. Xanh cổ vịt, đỏ son và vàng nghệ, ánh sáng ấm trên nền tối.',
  },
};

export function initial(): FullDraft {
  return {
    title: '', artwork: null, mode: 'style', crop: { x: 0, y: 0, w: 1, h: 1 },
    palette: [...samples.portrait.palette],
    style: '', world: '', subject_notes: '', subject_role: '', technique: 'impasto',
    controls: 'WASD, cảm ứng, nhảy, xoay camera, zoom và tour.',
    seed: Math.floor(Math.random() * 2147483647),
  };
}
