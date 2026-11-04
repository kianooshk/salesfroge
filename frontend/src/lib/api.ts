export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sf_token');
}

export function setToken(token: string) {
  localStorage.setItem('sf_token', token);
}

export function clearToken() {
  localStorage.removeItem('sf_token');
}

export async function api<T = any>(path: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API_URL}${path}`, { method: options.method || 'GET', headers, body });
  if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Please sign in again');
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const payload = await res.json();
      message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message || message;
    } catch {
      /* response had no json body */
    }
    throw new Error(message);
  }
  if (res.status === 204) return null as T;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) return res.json();
  return res as T;
}

export async function apiBlob(path: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Could not load the file');
  return { blob: await res.blob(), type: res.headers.get('content-type') || '' };
}

export function downloadExport(objectType: string, query = '') {
  const token = getToken();
  return fetch(`${API_URL}/export/${objectType}${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(async (res) => {
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${objectType.toLowerCase()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
}
