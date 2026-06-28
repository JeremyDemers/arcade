"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Crown,
  Gamepad2,
  Heart,
  LogOut,
  Pause,
  Play,
  Rocket,
  Sparkles,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { api, LeaderboardEntry, PlayerStats, User } from "@/lib/api";
import {
  createGame,
  GAME_HEIGHT,
  GAME_WIDTH,
  GameEvent,
  GameInput,
  launchBall,
  NeonGame,
  PADDLE_Y,
  updateGame,
} from "@/lib/neonShatter";

const STORAGE_KEY = "arcade:neon-shatter:session";
const SOUND_KEY = "arcade:neon-shatter:sound";
const MUSIC_VOLUME_SCALE = 0.28;
const EFFECTS_VOLUME_SCALE = 0.2;

type GameView = {
  status: NeonGame["status"];
  score: number;
  level: number;
  lives: number;
  bricksBroken: number;
  combo: number;
  launched: boolean;
  remaining: number;
};

function snapshot(game: NeonGame): GameView {
  return {
    status: game.status,
    score: game.score,
    level: game.level,
    lives: game.lives,
    bricksBroken: game.bricksBroken,
    combo: game.combo,
    launched: game.ball.launched,
    remaining: game.bricks.filter((brick) => brick.hp > 0).length,
  };
}

const STARS = Array.from({ length: 80 }, (_, index) => ({
  x: (index * 83.17) % GAME_WIDTH,
  y: (index * 137.41) % GAME_HEIGHT,
  radius: 0.6 + (index % 4) * 0.35,
  alpha: 0.12 + (index % 6) * 0.06,
}));

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawGame(canvas: HTMLCanvasElement, game: NeonGame) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== GAME_WIDTH * dpr || canvas.height !== GAME_HEIGHT * dpr) {
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const background = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  background.addColorStop(0, "#091326");
  background.addColorStop(0.55, "#070b17");
  background.addColorStop(1, "#03050b");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = "rgba(68, 240, 255, 0.035)";
  for (let x = 0; x < GAME_WIDTH; x += 40) ctx.fillRect(x, 0, 1, GAME_HEIGHT);
  for (let y = 0; y < GAME_HEIGHT; y += 40) ctx.fillRect(0, y, GAME_WIDTH, 1);

  for (const star of STARS) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#d9fbff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const rail = ctx.createLinearGradient(0, 0, GAME_WIDTH, 0);
  rail.addColorStop(0, "rgba(53, 232, 255, .5)");
  rail.addColorStop(0.5, "rgba(154, 91, 255, .14)");
  rail.addColorStop(1, "rgba(255, 76, 196, .5)");
  ctx.fillStyle = rail;
  ctx.fillRect(12, 12, GAME_WIDTH - 24, 2);
  ctx.fillRect(12, 12, 2, GAME_HEIGHT - 24);
  ctx.fillRect(GAME_WIDTH - 14, 12, 2, GAME_HEIGHT - 24);

  for (const brick of game.bricks) {
    if (brick.hp <= 0) continue;
    const alpha = brick.hp < brick.maxHp ? 0.56 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = `hsl(${brick.hue} 100% 62%)`;
    ctx.shadowBlur = 15;
    const fill = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
    fill.addColorStop(0, `hsl(${brick.hue} 100% 70%)`);
    fill.addColorStop(1, `hsl(${brick.hue} 78% 42%)`);
    roundedRect(ctx, brick.x, brick.y, brick.width, brick.height, 7);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.4)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.28)";
    roundedRect(ctx, brick.x + 6, brick.y + 5, brick.width - 12, 3, 2);
    ctx.fill();
    if (brick.maxHp > 1) {
      ctx.fillStyle = "rgba(4, 7, 17, .55)";
      roundedRect(ctx, brick.x + brick.width / 2 - 8, brick.y + brick.height / 2 - 3, 16, 6, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const particle of game.particles) {
    ctx.globalAlpha = Math.min(1, particle.life * 2);
    ctx.fillStyle = `hsl(${particle.hue} 100% 68%)`;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.shadowColor = "#44edff";
  ctx.shadowBlur = 22;
  const paddleGradient = ctx.createLinearGradient(game.paddle.x, PADDLE_Y, game.paddle.x + game.paddle.width, PADDLE_Y);
  paddleGradient.addColorStop(0, "#48eaff");
  paddleGradient.addColorStop(0.52, "#f4fdff");
  paddleGradient.addColorStop(1, "#b660ff");
  roundedRect(ctx, game.paddle.x, PADDLE_Y, game.paddle.width, game.paddle.height, 9);
  ctx.fillStyle = paddleGradient;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 22;
  const ballGradient = ctx.createRadialGradient(game.ball.x - 3, game.ball.y - 4, 1, game.ball.x, game.ball.y, game.ball.radius);
  ballGradient.addColorStop(0, "#ffffff");
  ballGradient.addColorStop(0.45, "#aaf9ff");
  ballGradient.addColorStop(1, "#4d9eff");
  ctx.fillStyle = ballGradient;
  ctx.beginPath();
  ctx.arc(game.ball.x, game.ball.y, game.ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (game.status === "playing" && !game.ball.launched) {
    ctx.fillStyle = "rgba(228, 250, 255, .82)";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.letterSpacing = "2px";
    ctx.fillText("PRESS SPACE OR LAUNCH", GAME_WIDTH / 2, 880);
  }
}

export function NeonShatterGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<NeonGame>(createGame());
  const inputRef = useRef<GameInput>({ left: false, right: false, targetX: null });
  const audioContextRef = useRef<AudioContext | null>(null);
  const themeRef = useRef<HTMLAudioElement | null>(null);
  const savedScoreRef = useRef<string | null>(null);
  const [view, setView] = useState<GameView>(() => snapshot(createGame()));
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isExchangingAuth, setIsExchangingAuth] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Sign in to save scores automatically.");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const isSignedIn = Boolean(token && user);

  const playTone = useCallback((event: GameEvent) => {
    if (!soundEnabled) return;
    const AudioContextClass = window.AudioContext;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequencies: Record<GameEvent, number> = {
      brick: 520,
      paddle: 230,
      launch: 340,
      life: 120,
      level: 760,
      gameOver: 82,
    };
    oscillator.type = event === "gameOver" ? "sawtooth" : event === "brick" ? "square" : "sine";
    oscillator.frequency.setValueAtTime(frequencies[event], context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      event === "level" ? 1280 : Math.max(45, frequencies[event] * 0.72),
      context.currentTime + (event === "level" ? 0.28 : 0.11),
    );
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, soundVolume * EFFECTS_VOLUME_SCALE),
      context.currentTime + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (event === "level" ? 0.32 : 0.14));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (event === "level" ? 0.34 : 0.16));
  }, [soundEnabled, soundVolume]);

  const loadLeaderboard = useCallback(async () => setLeaderboard(await api.leaderboard()), []);
  const loadStats = useCallback(async (sessionToken: string) => setStats(await api.stats(sessionToken)), []);

  const refreshView = useCallback(() => setView(snapshot(gameRef.current)), []);

  const startGame = useCallback(() => {
    gameRef.current = createGame("playing");
    savedScoreRef.current = null;
    if (themeRef.current) {
      themeRef.current.currentTime = 0;
      themeRef.current.volume = soundVolume * MUSIC_VOLUME_SCALE;
      if (soundEnabled) themeRef.current.play().catch(() => undefined);
    }
    refreshView();
    playTone("launch");
  }, [playTone, refreshView, soundEnabled, soundVolume]);

  const launch = useCallback(() => {
    if (launchBall(gameRef.current)) {
      playTone("launch");
      refreshView();
    }
  }, [playTone, refreshView]);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (game.status === "playing") game.status = "paused";
    else if (game.status === "paused") game.status = "playing";
    refreshView();
  }, [refreshView]);

  useEffect(() => {
    const theme = new Audio("/sounds/neon-shatter.mp3");
    theme.loop = true;
    theme.preload = "auto";
    themeRef.current = theme;
    return () => {
      theme.pause();
      themeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const theme = themeRef.current;
    if (!theme) return;
    theme.volume = soundVolume * MUSIC_VOLUME_SCALE;
    if (view.status === "playing" && soundEnabled) {
      theme.play().catch(() => undefined);
    } else {
      theme.pause();
    }
    if (view.status === "ready" || view.status === "gameOver") theme.currentTime = 0;
  }, [soundEnabled, soundVolume, view.status]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SOUND_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { enabled?: boolean; volume?: number };
      if (typeof parsed.enabled === "boolean") setSoundEnabled(parsed.enabled);
      if (typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1) setSoundVolume(parsed.volume);
    } catch {
      window.localStorage.removeItem(SOUND_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SOUND_KEY, JSON.stringify({ enabled: soundEnabled, volume: soundVolume }));
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
    await api.exchangeGoogle(credential)
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
    let animationFrame = 0;
    let previous = performance.now();
    let lastSnapshot = previous;
    const frame = (now: number) => {
      const events = updateGame(gameRef.current, (now - previous) / 1000, inputRef.current);
      previous = now;
      events.forEach(playTone);
      if (events.length || now - lastSnapshot > 80) {
        refreshView();
        lastSnapshot = now;
      }
      if (canvasRef.current) drawGame(canvasRef.current, gameRef.current);
      animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationFrame);
  }, [playTone, refreshView]);

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      const key = event.key.toLowerCase();
      if (event.key === "ArrowLeft" || key === "a") inputRef.current.left = true;
      if (event.key === "ArrowRight" || key === "d") inputRef.current.right = true;
      if ((event.code === "Space" || key === "enter") && !event.repeat) {
        if (gameRef.current.status === "ready" || gameRef.current.status === "gameOver") startGame();
        else if (gameRef.current.status === "paused") togglePause();
        else launch();
      }
      if (key === "p" && !event.repeat) togglePause();
    }
    function keyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowLeft" || key === "a") inputRef.current.left = false;
      if (event.key === "ArrowRight" || key === "d") inputRef.current.right = false;
    }
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [launch, startGame, togglePause]);

  useEffect(() => {
    const key = `${view.score}:${view.level}:${view.bricksBroken}`;
    if (view.status !== "gameOver" || savedScoreRef.current === key) return;
    savedScoreRef.current = key;
    if (!token || view.score <= 0) {
      setSaveStatus(token ? "No score to save yet." : "Sign in to save your next run.");
      return;
    }
    setSaveStatus("Saving score...");
    api.saveScore(token, view.score, view.level, view.bricksBroken)
      .then(() => Promise.all([loadLeaderboard(), loadStats(token)]))
      .then(() => setSaveStatus("Score saved. Leaderboard updated."))
      .catch((error: Error) => setSaveStatus(error.message));
  }, [loadLeaderboard, loadStats, token, view.bricksBroken, view.level, view.score, view.status]);

  function updatePointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    inputRef.current.targetX = ((event.clientX - rect.left) / rect.width) * GAME_WIDTH;
  }

  function clearLocalSession() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.google?.accounts.id.disableAutoSelect();
    setToken(null);
    setUser(null);
    setStats(null);
    setSaveStatus("Sign in to save scores automatically.");
  }

  const topAction = view.status === "playing" ? togglePause : view.status === "paused" ? togglePause : startGame;
  const topLabel = view.status === "playing" ? "Pause" : view.status === "paused" ? "Resume" : "Play";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={21} /></div>
          <div>
            <p className="eyebrow">Arcade transmission 002</p>
            <h1>Neon <span>Shatter</span></h1>
          </div>
        </div>
        <div className="top-actions">
          <button className="primary-button" type="button" onClick={topAction}>
            {view.status === "playing" ? <Pause size={18} /> : <Play size={18} />}
            {topLabel}
          </button>
          <button className="secondary-button" type="button" onClick={startGame}>
            <Gamepad2 size={18} /> New run
          </button>
        </div>
      </header>

      <section className="game-layout">
        <aside className="panel player-panel">
          <div className="panel-heading"><UserRound size={17} /><span>Player uplink</span></div>
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
              <div className="player-stats">
                <div><b>{(stats?.best_score ?? 0).toLocaleString()}</b><span>Personal best</span></div>
                <div><b>{stats?.games_played ?? 0}</b><span>Runs</span></div>
                <div><b>{stats?.total_bricks ?? 0}</b><span>Bricks shattered</span></div>
              </div>
              <div className="account-controls">
                <button className="signout-button g_id_signout" type="button" onClick={clearLocalSession}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-block">
              <p>Sign in with Google to save scores and claim your place on the board.</p>
              <GoogleSignIn disabled={isExchangingAuth} onCredential={handleGoogleCredential} />
              <p className="privacy-copy">Google shares your name, email, and profile picture. Arcade uses your name and picture for your player profile; your email is not stored.</p>
              {isExchangingAuth ? <p className="auth-progress">Connecting your account…</p> : null}
            </div>
          )}

          <div className="how-to">
            <div className="panel-heading"><Zap size={17} /><span>How to play</span></div>
            <p>Move with <kbd>A</kbd> <kbd>D</kbd> or arrow keys. Launch with <kbd>Space</kbd>. Keep the ball alive to build an 8× combo.</p>
          </div>
        </aside>

        <section className="game-stage" aria-label="Neon Shatter game">
          <div className="stage-hud">
            <span>Sector {String(view.level).padStart(2, "0")}</span>
            <strong>{view.score.toLocaleString()}</strong>
            <span>{view.remaining} targets</span>
          </div>
          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              aria-label="Brick breaker playfield"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                updatePointer(event);
                if (gameRef.current.status === "playing" && !gameRef.current.ball.launched) launch();
              }}
              onPointerMove={(event) => {
                if (event.buttons || event.pointerType === "touch") updatePointer(event);
              }}
              onPointerUp={() => { inputRef.current.targetX = null; }}
              onPointerCancel={() => { inputRef.current.targetX = null; }}
            />
            {view.status !== "playing" ? (
              <div className="game-overlay">
                <span>{view.status === "gameOver" ? "Game Over" : view.status === "paused" ? "Run suspended" : "System ready"}</span>
                <strong>{view.status === "gameOver" ? `${view.score.toLocaleString()} pts` : view.status === "paused" ? "Paused" : "Break the grid"}</strong>
                <button className="primary-button" type="button" onClick={view.status === "paused" ? togglePause : startGame}>
                  <Play size={18} /> {view.status === "gameOver" ? "Play again" : view.status === "paused" ? "Resume" : "Start run"}
                </button>
              </div>
            ) : null}
          </div>
          <div className="mobile-controls">
            <button
              type="button"
              onPointerDown={() => { inputRef.current.left = true; inputRef.current.targetX = null; }}
              onPointerUp={() => { inputRef.current.left = false; }}
              onPointerLeave={() => { inputRef.current.left = false; }}
            >←</button>
            <button className="launch-button" type="button" onClick={launch}><Rocket size={18} /> Launch</button>
            <button
              type="button"
              onPointerDown={() => { inputRef.current.right = true; inputRef.current.targetX = null; }}
              onPointerUp={() => { inputRef.current.right = false; }}
              onPointerLeave={() => { inputRef.current.right = false; }}
            >→</button>
          </div>
        </section>

        <aside className="panel run-panel">
          <div className="panel-heading"><Rocket size={17} /><span>Live run</span></div>
          <div className="run-score"><span>Score</span><strong>{view.score.toLocaleString()}</strong></div>
          <div className="run-grid">
            <div><span>Sector</span><b>{String(view.level).padStart(2, "0")}</b></div>
            <div><span>Shattered</span><b>{view.bricksBroken}</b></div>
            <div><span>Combo</span><b className="combo">{view.combo}×</b></div>
            <div><span>Lives</span><b className="hearts">{Array.from({ length: view.lives }, (_, i) => <Heart key={i} size={16} fill="currentColor" />)}</b></div>
          </div>

          <div className="status-card">
            <i className={view.launched && view.status === "playing" ? "live" : ""} />
            <div><span>Ball status</span><strong>{view.status === "gameOver" ? "Offline" : view.launched ? "In play" : "Docked"}</strong></div>
          </div>

          <div className="audio-controls">
            <button type="button" onClick={() => setSoundEnabled((current) => !current)}>
              {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              {soundEnabled ? "Sound on" : "Muted"}
            </button>
            <label>
              <span>Volume</span>
              <input type="range" min={0} max={100} value={Math.round(soundVolume * 100)} onChange={(event) => setSoundVolume(Number(event.target.value) / 100)} />
            </label>
          </div>
        </aside>
      </section>

      <section className="leaderboard panel">
        <div className="leaderboard-title">
          <div className="panel-heading"><Trophy size={17} /><span>Global high signals</span></div>
          <p>Top ten operators</p>
        </div>
        <div className="score-list">
          {leaderboard.length ? leaderboard.map((entry, index) => (
            <div className="score-row" key={entry.id}>
              <span className="rank">{index === 0 ? <Crown size={16} /> : String(index + 1).padStart(2, "0")}</span>
              <div><strong>{entry.username}</strong><small>Sector {entry.level} · {entry.bricks} shattered</small></div>
              <b>{entry.score.toLocaleString()}</b>
            </div>
          )) : <p className="empty-state">No signals yet. Yours could be the first one through.</p>}
        </div>
      </section>
    </main>
  );
}
