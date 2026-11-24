export function readRoute() {
  return location.hash.slice(1).split('/').filter(Boolean);
}

export function go(...path: string[]) {
  location.hash = '/' + path.map(encodeURIComponent).join('/');
}
