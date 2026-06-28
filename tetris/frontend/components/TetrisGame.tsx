"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Crown,
  Gamepad2,
  LogOut,
  Pause,
  Play,
  RotateCw,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { api, LeaderboardEntry, PlayerStats, User } from "@/lib/api";

const WIDTH = 10;
const HEIGHT = 20;
const STORAGE_KEY = "arcade:tetris:session";
const SOUND_SETTINGS_KEY = "arcade:tetris:sound";
const INITIAL_SEED = 20260531;

type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Board = Cell[][];
type PieceKind = "I" | "J" | "L" | "O" | "S" | "T" | "Z";
type Status = "ready" | "playing" | "paused" | "gameOver";

type Piece = {
  kind: PieceKind;
  matrix: Cell[][];
  x: number;
  y: number;
};

type GameState = {
  board: Board;
  active: Piece;
  queue: PieceKind[];
  held: PieceKind | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  status: Status;
};

const SHAPES: Record<PieceKind, Cell[][]> = {
  I: [[1, 1, 1, 1]],
  J: [
    [2, 0, 0],
    [2, 2, 2],
  ],
  L: [
    [0, 0, 3],
    [3, 3, 3],
  ],
  O: [
    [4, 4],
    [4, 4],
  ],
  S: [
    [0, 5, 5],
    [5, 5, 0],
  ],
  T: [
    [0, 6, 0],
    [6, 6, 6],
  ],
  Z: [
    [7, 7, 0],
    [0, 7, 7],
  ],
};

const CELL_CLASSES = [
  "empty",
  "cyan",
  "blue",
  "amber",
  "yellow",
  "green",
  "violet",
  "red",
];

const LINE_POINTS = [0, 100, 300, 500, 800];

type SoundName = "move" | "rotate" | "drop" | "lineClear";

function emptyBoard(): Board {
  return Array.from({ length: HEIGHT }, () => Array<Cell>(WIDTH).fill(0));
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function bag(rng: () => number = Math.random): PieceKind[] {
  const pieces: PieceKind[] = ["I", "J", "L", "O", "S", "T", "Z"];
  for (let i = pieces.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return pieces;
}

function makePiece(kind: PieceKind): Piece {
  const matrix = SHAPES[kind].map((row) => [...row]) as Cell[][];
  return {
    kind,
    matrix,
    x: Math.floor((WIDTH - matrix[0].length) / 2),
    y: 0,
  };
}

function refillQueue(queue: PieceKind[], rng: () => number = Math.random): PieceKind[] {
  let next = [...queue];
  while (next.length < 7) next = [...next, ...bag(rng)];
  return next;
}

function spawnFromQueue(queue: PieceKind[], rng: () => number = Math.random): { active: Piece; queue: PieceKind[] } {
  const next = refillQueue(queue, rng);
  const [kind, ...rest] = next;
  return { active: makePiece(kind), queue: refillQueue(rest, rng) };
}

function rotate(matrix: Cell[][]): Cell[][] {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse()) as Cell[][];
}

function collides(board: Board, piece: Piece): boolean {
  return piece.matrix.some((row, y) =>
    row.some((value, x) => {
      if (!value) return false;
      const nextX = piece.x + x;
      const nextY = piece.y + y;
      return nextX < 0 || nextX >= WIDTH || nextY >= HEIGHT || Boolean(board[nextY]?.[nextX]);
    }),
  );
}

function merge(board: Board, piece: Piece): Board {
  const next = board.map((row) => [...row]) as Board;
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && next[piece.y + y]?.[piece.x + x] !== undefined) {
        next[piece.y + y][piece.x + x] = value;
      }
    });
  });
  return next;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const cleared = HEIGHT - remaining.length;
  return {
    board: [...Array.from({ length: cleared }, () => Array<Cell>(WIDTH).fill(0)), ...remaining] as Board,
    cleared,
  };
}

function ghostPiece(board: Board, piece: Piece): Piece {
  let ghost = { ...piece, matrix: piece.matrix.map((row) => [...row]) as Cell[][] };
  while (!collides(board, { ...ghost, y: ghost.y + 1 })) {
    ghost = { ...ghost, y: ghost.y + 1 };
  }
  return ghost;
}

function createGame(rng: () => number = Math.random): GameState {
  const queue = refillQueue(bag(rng), rng);
  const { active, queue: rest } = spawnFromQueue(queue, rng);
  return {
    board: emptyBoard(),
    active,
    queue: rest,
    held: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    status: "ready",
  };
}

function lockPiece(state: GameState): GameState {
  const merged = merge(state.board, state.active);
  const { board, cleared } = clearLines(merged);
  const score = state.score + LINE_POINTS[cleared] * state.level + 10;
  const lines = state.lines + cleared;
  const level = Math.floor(lines / 10) + 1;
  const { active, queue } = spawnFromQueue(state.queue);
  const status = collides(board, active) ? "gameOver" : state.status;

  return {
    ...state,
    board,
    active,
    queue,
    score,
    lines,
    level,
    status,
    canHold: true,
  };
}

function moveDown(state: GameState): GameState {
  const active = { ...state.active, y: state.active.y + 1 };
  return collides(state.board, active) ? lockPiece(state) : { ...state, active, score: state.score + 1 };
}

export function TetrisGame() {
  const [game, setGame] = useState<GameState>(() => createGame(createSeededRng(INITIAL_SEED)));
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isExchangingAuth, setIsExchangingAuth] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Sign in to save scores automatically.");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.55);
  const isSignedIn = Boolean(token && user);
  const savedScoreRef = useRef<string | null>(null);
  const previousLinesRef = useRef(0);
  const soundsRef = useRef<Record<SoundName, HTMLAudioElement> | null>(null);
  const themeRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(
    (name: SoundName) => {
      if (!soundEnabled) return;
      const audio = soundsRef.current?.[name];
      if (!audio) return;
      audio.currentTime = 0;
      audio.volume = soundVolume;
      audio.play().catch(() => undefined);
    },
    [soundEnabled, soundVolume],
  );

  const loadLeaderboard = useCallback(async () => {
    const rows = await api.leaderboard();
    setLeaderboard(rows);
  }, []);

  const loadStats = useCallback(async (sessionToken: string) => {
    const nextStats = await api.stats(sessionToken);
    setStats(nextStats);
  }, []);

  useEffect(() => {
    soundsRef.current = {
      move: new Audio("/sounds/tetris-move-right-left.mp3"),
      rotate: new Audio("/sounds/tetris-rotate.mp3"),
      drop: new Audio("/sounds/tetris-drop.mp3"),
      lineClear: new Audio("/sounds/tetris-line-cleared.mp3"),
    };
    themeRef.current = new Audio("/sounds/tetris_theme.mp3");
    themeRef.current.loop = true;
    Object.values(soundsRef.current).forEach((audio) => {
      audio.preload = "auto";
    });
    themeRef.current.preload = "auto";

    return () => {
      themeRef.current?.pause();
      themeRef.current = null;
      soundsRef.current = null;
    };
  }, []);

  useEffect(() => {
    Object.values(soundsRef.current ?? {}).forEach((audio) => {
      audio.volume = soundVolume;
    });
    if (themeRef.current) themeRef.current.volume = soundVolume;
  }, [soundVolume]);

  useEffect(() => {
    if (game.lines > previousLinesRef.current) {
      playSound("lineClear");
    }
    previousLinesRef.current = game.lines;
  }, [game.lines, playSound]);

  useEffect(() => {
    const theme = themeRef.current;
    if (!theme) return;
    theme.volume = soundVolume;

    if (game.status === "playing" && soundEnabled) {
      theme.play().catch(() => undefined);
      return;
    }

    theme.pause();
    if (game.status === "ready" || game.status === "gameOver") {
      theme.currentTime = 0;
    }
  }, [game.status, soundEnabled, soundVolume]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SOUND_SETTINGS_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { enabled?: boolean; volume?: number };
      if (typeof parsed.enabled === "boolean") setSoundEnabled(parsed.enabled);
      if (typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1) {
        setSoundVolume(parsed.volume);
      }
    } catch {
      window.localStorage.removeItem(SOUND_SETTINGS_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SOUND_SETTINGS_KEY,
      JSON.stringify({ enabled: soundEnabled, volume: soundVolume }),
    );
  }, [soundEnabled, soundVolume]);

  useEffect(() => {
    loadLeaderboard().catch(() => setLeaderboard([]));
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const session = JSON.parse(stored) as { token: string; user: User };
      setToken(session.token);
      setUser(session.user);
      setSaveStatus(`Signed in as ${session.user.username}. Scores save automatically.`);
      loadStats(session.token).catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
        setStats(null);
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [loadLeaderboard, loadStats]);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setIsExchangingAuth(true);
    setSaveStatus("Connecting your account...");
    await api
      .exchangeGoogle(credential)
      .then((response) => {
        setToken(response.token);
        setUser(response.user);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
        setSaveStatus(`Signed in as ${response.user.username}. Scores save automatically.`);
        return Promise.all([loadLeaderboard(), loadStats(response.token)]);
      })
      .catch((error: Error) => {
        setSaveStatus(error.message || "Unable to connect account.");
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsExchangingAuth(false));
  }, [loadLeaderboard, loadStats]);

  useEffect(() => {
    if (game.status !== "playing") return;
    const speed = Math.max(90, 720 - (game.level - 1) * 55);
    const interval = window.setInterval(() => {
      setGame((current) => (current.status === "playing" ? moveDown(current) : current));
    }, speed);
    return () => window.clearInterval(interval);
  }, [game.level, game.status]);

  useEffect(() => {
    const key = `${game.score}:${game.lines}:${game.level}`;
    if (game.status !== "gameOver" || savedScoreRef.current === key) return;
    savedScoreRef.current = key;

    if (!token || game.score <= 0) {
      setSaveStatus(token ? "No score to save yet." : "Sign in to save your next run.");
      return;
    }

    setSaveStatus("Saving score...");
    api
      .saveScore(token, game.score, game.level, game.lines)
      .then(() => Promise.all([loadLeaderboard(), loadStats(token)]))
      .then(() => setSaveStatus("Score saved. Leaderboard updated."))
      .catch((error: Error) => setSaveStatus(error.message));
  }, [game.level, game.lines, game.score, game.status, loadLeaderboard, loadStats, token]);

  const startGame = useCallback(() => {
    savedScoreRef.current = null;
    const theme = themeRef.current;
    if (theme) {
      theme.currentTime = 0;
      theme.volume = soundVolume;
      if (soundEnabled) theme.play().catch(() => undefined);
    }
    setGame({ ...createGame(), status: "playing" });
  }, [soundEnabled, soundVolume]);

  const togglePause = useCallback(() => {
    setGame((current) => {
      if (current.status === "playing") return { ...current, status: "paused" };
      if (current.status === "paused") return { ...current, status: "playing" };
      return current;
    });
  }, []);

  const move = useCallback((dx: number) => {
    setGame((current) => {
      if (current.status !== "playing") return current;
      const active = { ...current.active, x: current.active.x + dx };
      return collides(current.board, active) ? current : { ...current, active };
    });
  }, []);

  const softDrop = useCallback(() => {
    setGame((current) => (current.status === "playing" ? moveDown(current) : current));
  }, []);

  const hardDrop = useCallback(() => {
    setGame((current) => {
      if (current.status !== "playing") return current;
      return lockPiece({ ...current, active: ghostPiece(current.board, current.active), score: current.score + 20 });
    });
  }, []);

  const rotateActive = useCallback(() => {
    setGame((current) => {
      if (current.status !== "playing" || current.active.kind === "O") return current;
      const rotated = { ...current.active, matrix: rotate(current.active.matrix) };
      const kicks = [0, -1, 1, -2, 2];
      const kicked = kicks
        .map((kick) => ({ ...rotated, x: rotated.x + kick }))
        .find((piece) => !collides(current.board, piece));
      return kicked ? { ...current, active: kicked } : current;
    });
  }, []);

  const hold = useCallback(() => {
    setGame((current) => {
      if (current.status !== "playing" || !current.canHold) return current;
      if (!current.held) {
        const { active, queue } = spawnFromQueue(current.queue);
        return { ...current, active, queue, held: current.active.kind, canHold: false };
      }
      return {
        ...current,
        active: makePiece(current.held),
        held: current.active.kind,
        canHold: false,
      };
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = typeof event.key === "string" ? event.key : "";
      const lowerKey = key.toLowerCase();

      if (key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
        playSound("move");
      } else if (key === "ArrowRight") {
        event.preventDefault();
        move(1);
        playSound("move");
      } else if (key === "ArrowDown") {
        event.preventDefault();
        softDrop();
        playSound("drop");
      } else if (key === "ArrowUp" || lowerKey === "x" || lowerKey === "a" || lowerKey === "d") {
        event.preventDefault();
        rotateActive();
        playSound("rotate");
      } else if (event.code === "Space") {
        event.preventDefault();
        hardDrop();
        playSound("drop");
      } else if (lowerKey === "c") {
        event.preventDefault();
        hold();
      } else if (lowerKey === "p") {
        event.preventDefault();
        togglePause();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hardDrop, hold, move, playSound, rotateActive, softDrop, togglePause]);

  function clearLocalSession() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.google?.accounts.id.disableAutoSelect();
    setToken(null);
    setUser(null);
    setStats(null);
    setSaveStatus("Sign in to save scores automatically.");
  }

  const ghost = useMemo(() => ghostPiece(game.board, game.active), [game.active, game.board]);
  const visible = useMemo(() => {
    const map = new Map<string, { value: Cell; ghost?: boolean }>();
    ghost.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) map.set(`${ghost.x + x}:${ghost.y + y}`, { value, ghost: true });
      });
    });
    game.active.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) map.set(`${game.active.x + x}:${game.active.y + y}`, { value });
      });
    });
    return map;
  }, [game.active, ghost]);

  const primaryAction = game.status === "playing" ? togglePause : startGame;
  const primaryLabel = game.status === "playing" ? "Pause" : game.status === "paused" ? "Resume" : "Play";

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brand-lockup">
          <div className="brand-icon" aria-hidden="true">
            <Gamepad2 size={24} />
          </div>
          <div>
            <p className="eyebrow">Arcade transmission 001</p>
            <h1>Tetris</h1>
          </div>
        </div>
        <div className="top-actions">
          <div className={`status-pill ${game.status}`}>
            <i />
            <span>{game.status === "gameOver" ? "Game over" : game.status}</span>
          </div>
          <button className="icon-button" type="button" onClick={primaryAction} title={primaryLabel}>
            {game.status === "playing" ? <Pause size={20} /> : <Play size={20} />}
            <span>{primaryLabel}</span>
          </button>
          <button className="icon-button muted" type="button" onClick={startGame} title="New game">
            <Gamepad2 size={20} />
            <span>New</span>
          </button>
        </div>
      </section>

      <section className="game-layout">
        <aside className="side-panel account-panel">
          <div className="panel-title">
            <UserRound size={18} />
            <span>Player</span>
          </div>

          {isSignedIn ? (
            <div className="signed-in">
              <div className="player-identity">
                {user?.picture_url ? (
                  <Image src={user.picture_url} alt="Google profile" width={46} height={46} referrerPolicy="no-referrer" />
                ) : null}
                <div>
                  <span>Signed in as</span>
                  <strong>{user?.username ?? "Player"}</strong>
                </div>
              </div>
              <p>{isExchangingAuth ? "Connecting your account..." : saveStatus}</p>
              <div className="stat-grid compact">
                <span>
                  <b>{stats?.best_score ?? 0}</b>
                  Best
                </span>
                <span>
                  <b>{stats?.games_played ?? 0}</b>
                  Runs
                </span>
                <span>
                  <b>{stats?.total_lines ?? 0}</b>
                  Lines
                </span>
              </div>
              <div className="account-controls">
                <button className="signout-button g_id_signout" type="button" onClick={clearLocalSession}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-form">
              <p className="auth-copy">Sign in with Google to save scores and appear on the leaderboard.</p>
              <GoogleSignIn disabled={isExchangingAuth} onCredential={handleGoogleCredential} />
              <p className="privacy-copy">Google shares your name, email, and profile picture. Arcade uses your name and picture for your player profile; your email is not stored.</p>
              {isExchangingAuth ? <p className="auth-progress">Connecting your account…</p> : null}
            </div>
          )}
        </aside>

        <section className="board-stage" aria-label="Tetris game board">
          <div className="stage-meta">
            <span>Matrix 10 × 20</span>
            <strong>{game.score.toLocaleString().padStart(6, "0")}</strong>
            <span>Level {String(game.level).padStart(2, "0")}</span>
          </div>
          <div className="board-wrap">
            <div className={`board ${game.status}`}>
              {game.board.flatMap((row, y) =>
                row.map((value, x) => {
                  const activeCell = visible.get(`${x}:${y}`);
                  const cell = activeCell?.value ?? value;
                  const className = `cell ${CELL_CLASSES[cell]}${activeCell?.ghost ? " ghost" : ""}`;
                  return <div className={className} key={`${x}-${y}`} />;
                }),
              )}
              {game.status !== "playing" ? (
                <div className="board-overlay">
                  <span>{game.status === "gameOver" ? "Run complete" : game.status === "paused" ? "Game suspended" : "System ready"}</span>
                  <strong>{game.status === "gameOver" ? "Game Over" : game.status === "paused" ? "Paused" : "Ready"}</strong>
                  <button type="button" onClick={game.status === "paused" ? togglePause : startGame}>
                    <Play size={17} />
                    {game.status === "gameOver" ? "Play again" : game.status === "paused" ? "Resume" : "Start game"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="key-hints" aria-label="Keyboard controls">
            <span><kbd>←</kbd><kbd>→</kbd> Move</span>
            <span><kbd>↑</kbd> Rotate</span>
            <span><kbd>Space</kbd> Drop</span>
            <span><kbd>C</kbd> Hold</span>
          </div>
        </section>

        <aside className="side-panel game-panel">
          <div className="panel-title">
            <RotateCw size={18} />
            <span>Live game</span>
          </div>
          <div className="stat-grid">
            <span>
              <b>{game.score.toLocaleString()}</b>
              Score
            </span>
            <span>
              <b>{game.level}</b>
              Level
            </span>
            <span>
              <b>{game.lines}</b>
              Lines
            </span>
          </div>

          <div className="preview-row">
            <PiecePreview title="Hold" kind={game.held} />
            <PiecePreview title="Next" kind={game.queue[0]} />
          </div>

          <div className="controls">
            <button type="button" onClick={() => { move(-1); playSound("move"); }} title="Move left">←</button>
            <button type="button" onClick={() => { rotateActive(); playSound("rotate"); }} title="Rotate">
              <RotateCw size={18} />
            </button>
            <button type="button" onClick={() => { move(1); playSound("move"); }} title="Move right">→</button>
            <button type="button" onClick={() => { softDrop(); playSound("drop"); }} title="Soft drop">↓</button>
            <button type="button" onClick={() => { hardDrop(); playSound("drop"); }} title="Hard drop">Drop</button>
            <button type="button" onClick={hold} title="Hold piece">Hold</button>
          </div>

          <div className="audio-controls">
            <button
              type="button"
              className="audio-toggle"
              onClick={() => setSoundEnabled((current) => !current)}
              title={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? "Sound on" : "Muted"}</span>
            </button>
            <label className="audio-slider">
              <span>Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(soundVolume * 100)}
                onChange={(event) => setSoundVolume(Number(event.target.value) / 100)}
              />
            </label>
          </div>
        </aside>
      </section>

      <section className="leaderboard">
        <div className="leaderboard-heading">
          <div className="panel-title">
            <Trophy size={18} />
            <span>Top Ten</span>
          </div>
          <p>Global high scores</p>
        </div>
        <div className="score-list">
          {leaderboard.length ? (
            leaderboard.map((entry, index) => (
              <div className="score-row" key={entry.id}>
                <span className="rank">{index === 0 ? <Crown size={16} /> : index + 1}</span>
                <strong>{entry.username}</strong>
                <span>{entry.score.toLocaleString()}</span>
                <small>
                  L{entry.level} · {entry.lines} lines
                </small>
              </div>
            ))
          ) : (
            <p className="empty-state">No scores yet. The first clean run gets the spotlight.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function PiecePreview({ title, kind }: { title: string; kind: PieceKind | null }) {
  const matrix = kind ? SHAPES[kind] : [[0]];
  return (
    <div className="preview">
      <span>{title}</span>
      <div className="mini-grid">
        {Array.from({ length: 16 }, (_, index) => {
          const x = index % 4;
          const y = Math.floor(index / 4);
          const value = matrix[y]?.[x] ?? 0;
          return <i className={`mini-cell ${CELL_CLASSES[value]}`} key={index} />;
        })}
      </div>
    </div>
  );
}
