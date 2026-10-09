/**
 * API client for Smart Quiz Platform with automatic Telegram Mini App authentication
 */

const API_BASE = '/api';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('smart_quiz_token');
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('smart_quiz_token', token);
  }
}

export async function initTelegramAuth(): Promise<any> {
  if (typeof window === 'undefined') return null;

  // @ts-ignore
  const tg = window.Telegram?.WebApp;
  if (tg && tg.initData) {
    try {
      const res = await fetch(`${API_BASE}/auth/telegram-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
        return data.user;
      }
    } catch (e) {
      console.warn('Telegram auth error:', e);
    }
  }

  // Fallback demo user if not logged in
  if (!getAuthToken()) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'demo_teacher', role: 'TEACHER' }),
      });
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
        return data.user;
      }
    } catch {}
  }

  return null;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API so‘rovida xatolik: ${res.status}`);
  }

  return res.json();
}
