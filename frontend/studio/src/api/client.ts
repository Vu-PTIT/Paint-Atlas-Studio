const studioHeader = { 'X-Paint-Atlas': 'studio' };

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, init);
  if (!response.ok) {
    const { detail } = await response.json().catch(() => ({}));
    const message = Array.isArray(detail)
      ? detail.map(item => item.msg ?? String(item)).join(' · ')
      : detail;
    throw Error(typeof message === 'string' ? message : 'Yêu cầu chưa thực hiện được.');
  }
  return response.json();
}

export function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: body === undefined ? studioHeader : { ...studioHeader, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function uploadArtwork(file: File) {
  return request<{ id: string; palette: string[]; width: number; height: number }>('/artworks', {
    method: 'POST',
    headers: studioHeader,
    body: file,
  });
}
