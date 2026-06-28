export type User = {
  id: number;
  username: string;
  picture_url?: string | null;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type LeaderboardEntry = {
  id: number;
  username: string;
  score: number;
  level: number;
  lines: number;
  created_at: string;
};

export type PlayerStats = {
  games_played: number;
  best_score: number;
  total_lines: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const target = path.startsWith("/api/") ? path : `${API_BASE}${path}`;
  const response = await fetch(target, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(body.detail ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export const api = {
  exchangeGoogle: (credential: string) =>
    request<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  leaderboard: () => request<LeaderboardEntry[]>("/games/tetris/leaderboard"),
  stats: (token: string) =>
    request<PlayerStats>("/games/tetris/stats", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  saveScore: (token: string, score: number, level: number, lines: number) =>
    request<LeaderboardEntry>("/games/tetris/scores", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score, level, lines }),
    }),
};
