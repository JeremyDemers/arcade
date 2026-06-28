export type User = { id: number; username: string; picture_url?: string | null };
export type AuthResponse = { token: string; user: User };

export type LeaderboardEntry = {
  id: number;
  username: string;
  score: number;
  level: number;
  bricks: number;
  created_at: string;
};

export type PlayerStats = {
  games_played: number;
  best_score: number;
  total_bricks: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const target = path.startsWith("/api/") ? path : `${API_BASE}${path}`;
  const response = await fetch(target, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(body.detail ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export const api = {
  exchangeGoogle: (credential: string) =>
    request<AuthResponse>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  leaderboard: () => request<LeaderboardEntry[]>("/games/neon-shatter/leaderboard"),
  stats: (token: string) =>
    request<PlayerStats>("/games/neon-shatter/stats", { headers: { Authorization: `Bearer ${token}` } }),
  saveScore: (token: string, score: number, level: number, bricks: number) =>
    request<LeaderboardEntry>("/games/neon-shatter/scores", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score, level, bricks }),
    }),
};
