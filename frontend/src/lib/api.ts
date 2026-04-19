const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

export const api = {
  auth: {
    sendMagicLink: (email: string) =>
      request('/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) }),
    verify: (token: string, inviteCode?: string) =>
      request<{ accessToken: string; user: User }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token, inviteCode }),
      }),
    me: () => request<User>('/auth/me'),
  },
  users: {
    all: () => request<User[]>('/users'),
    leaderboard: () => request<User[]>('/users/leaderboard'),
    updateMe: (data: { name?: string; avatarUrl?: string }) =>
      request<User>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
    createInvite: () => request<{ code: string }>('/users/invite', { method: 'POST' }),
    listInvites: () => request<Invite[]>('/users/invites'),
  },
  tournaments: {
    all: () => request<Tournament[]>('/tournaments'),
    one: (id: string) => request<Tournament>(`/tournaments/${id}`),
    create: (name: string) => request<Tournament>('/tournaments', { method: 'POST', body: JSON.stringify({ name }) }),
    addPlayer: (id: string, userId: string) =>
      request(`/tournaments/${id}/players`, { method: 'POST', body: JSON.stringify({ userId }) }),
    start: (id: string) => request<Tournament>(`/tournaments/${id}/start`, { method: 'POST' }),
    reportWinner: (matchId: string, winnerId: string) =>
      request<Tournament>(`/tournaments/matches/${matchId}/winner`, { method: 'PATCH', body: JSON.stringify({ winnerId }) }),
  },
  sessions: {
    all: () => request<Session[]>('/sessions'),
    one: (id: string) => request<Session>(`/sessions/${id}`),
    create: (data: { label?: string; isOnline?: boolean; date?: string }) =>
      request<Session>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
    finalize: (id: string, results: { userId: string; endChips: number; rebuys?: number }[]) =>
      request<Session>(`/sessions/${id}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ results }),
      }),
  },
};

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  totalEarnings: number;
  isAdmin: boolean;
}

export interface Invite {
  id: string;
  code: string;
  createdBy: { name: string };
  usedBy?: { name: string };
  createdAt: string;
}

export interface SessionResult {
  id: string;
  userId: string;
  startChips: number;
  endChips: number;
  profit: number;
  rebuys: number;
  user: { name: string; avatarUrl?: string; avatarStyle?: string };
}

export interface TournamentMatch {
  id: string;
  round: number;
  seat: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  status: string;
}

export interface TournamentPlayer {
  id: string;
  userId: string;
  seed: number;
  eliminated: boolean;
  user: { id: string; name: string; avatarUrl?: string; avatarStyle?: string };
}

export interface Tournament {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  players: TournamentPlayer[];
  matches: TournamentMatch[];
}

export interface Session {
  id: string;
  date: string;
  isOnline: boolean;
  label?: string;
  results: SessionResult[];
}
