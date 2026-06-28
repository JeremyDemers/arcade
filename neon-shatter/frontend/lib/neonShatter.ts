export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 900;
export const PADDLE_Y = 824;

export type GameStatus = "ready" | "playing" | "paused" | "gameOver";
export type GameEvent = "brick" | "paddle" | "launch" | "life" | "level" | "gameOver";

export type Ball = { x: number; y: number; vx: number; vy: number; radius: number; launched: boolean };
export type Paddle = { x: number; width: number; height: number };
export type Brick = { id: number; x: number; y: number; width: number; height: number; hp: number; maxHp: number; hue: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number; size: number };

export type NeonGame = {
  status: GameStatus;
  score: number;
  level: number;
  lives: number;
  bricksBroken: number;
  combo: number;
  comboTimer: number;
  paddle: Paddle;
  ball: Ball;
  bricks: Brick[];
  particles: Particle[];
};

export type GameInput = { left: boolean; right: boolean; targetX: number | null };

const PADDLE_HEIGHT = 18;
const BALL_RADIUS = 9;

function makeBricks(level: number): Brick[] {
  const columns = 9;
  const rows = Math.min(6 + Math.floor((level - 1) / 2), 9);
  const gap = 8;
  const side = 38;
  const top = 112;
  const width = (GAME_WIDTH - side * 2 - gap * (columns - 1)) / columns;
  const height = 32;
  const bricks: Brick[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const reinforced = level >= 3 && (row + column + level) % 7 === 0;
      const hp = reinforced ? 2 : 1;
      bricks.push({
        id: row * columns + column,
        x: side + column * (width + gap),
        y: top + row * (height + gap),
        width,
        height,
        hp,
        maxHp: hp,
        hue: (186 + row * 22 + column * 3 + level * 9) % 360,
      });
    }
  }
  return bricks;
}

function dockBall(game: NeonGame) {
  game.ball.x = game.paddle.x + game.paddle.width / 2;
  game.ball.y = PADDLE_Y - game.ball.radius - 4;
  game.ball.vx = 0;
  game.ball.vy = 0;
  game.ball.launched = false;
}

export function createGame(status: GameStatus = "ready"): NeonGame {
  const paddle: Paddle = { x: GAME_WIDTH / 2 - 66, width: 132, height: PADDLE_HEIGHT };
  const game: NeonGame = {
    status,
    score: 0,
    level: 1,
    lives: 3,
    bricksBroken: 0,
    combo: 1,
    comboTimer: 0,
    paddle,
    ball: { x: 0, y: 0, vx: 0, vy: 0, radius: BALL_RADIUS, launched: false },
    bricks: makeBricks(1),
    particles: [],
  };
  dockBall(game);
  return game;
}

export function launchBall(game: NeonGame): boolean {
  if (game.status !== "playing" || game.ball.launched) return false;
  const speed = 465 + (game.level - 1) * 24;
  const direction = Math.random() > 0.5 ? 1 : -1;
  game.ball.vx = speed * 0.48 * direction;
  game.ball.vy = -Math.sqrt(speed * speed - game.ball.vx * game.ball.vx);
  game.ball.launched = true;
  return true;
}

function spawnParticles(game: NeonGame, brick: Brick) {
  for (let i = 0; i < 10; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 160;
    game.particles.push({
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.4,
      hue: brick.hue,
      size: 2 + Math.random() * 4,
    });
  }
}

function circleHitsBrick(ball: Ball, brick: Brick): boolean {
  const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
  const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
}

function resetForNextLevel(game: NeonGame) {
  game.level += 1;
  game.score += 750 * game.level;
  game.combo = 1;
  game.comboTimer = 0;
  game.paddle.width = Math.max(92, 132 - (game.level - 1) * 4);
  game.paddle.x = GAME_WIDTH / 2 - game.paddle.width / 2;
  game.bricks = makeBricks(game.level);
  dockBall(game);
}

export function updateGame(game: NeonGame, dt: number, input: GameInput): GameEvent[] {
  const events: GameEvent[] = [];
  const frameTime = Math.min(dt, 0.025);

  game.particles = game.particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * frameTime,
      y: particle.y + particle.vy * frameTime,
      vy: particle.vy + 180 * frameTime,
      life: particle.life - frameTime,
    }))
    .filter((particle) => particle.life > 0);

  if (game.status !== "playing") return events;

  const paddleSpeed = 690;
  if (input.targetX !== null) {
    const desired = input.targetX - game.paddle.width / 2;
    const distance = desired - game.paddle.x;
    game.paddle.x += Math.sign(distance) * Math.min(Math.abs(distance), paddleSpeed * 1.8 * frameTime);
  } else {
    game.paddle.x += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * paddleSpeed * frameTime;
  }
  game.paddle.x = Math.max(18, Math.min(GAME_WIDTH - game.paddle.width - 18, game.paddle.x));

  if (!game.ball.launched) {
    dockBall(game);
    return events;
  }

  if (game.comboTimer > 0) {
    game.comboTimer -= frameTime;
    if (game.comboTimer <= 0) game.combo = 1;
  }

  const previousX = game.ball.x;
  const previousY = game.ball.y;
  game.ball.x += game.ball.vx * frameTime;
  game.ball.y += game.ball.vy * frameTime;

  if (game.ball.x - game.ball.radius <= 14 && game.ball.vx < 0) {
    game.ball.x = 14 + game.ball.radius;
    game.ball.vx *= -1;
  } else if (game.ball.x + game.ball.radius >= GAME_WIDTH - 14 && game.ball.vx > 0) {
    game.ball.x = GAME_WIDTH - 14 - game.ball.radius;
    game.ball.vx *= -1;
  }
  if (game.ball.y - game.ball.radius <= 14 && game.ball.vy < 0) {
    game.ball.y = 14 + game.ball.radius;
    game.ball.vy *= -1;
  }

  const paddleTop = PADDLE_Y;
  const paddleHit =
    game.ball.vy > 0 &&
    game.ball.y + game.ball.radius >= paddleTop &&
    previousY + game.ball.radius <= paddleTop + 8 &&
    game.ball.x >= game.paddle.x - game.ball.radius &&
    game.ball.x <= game.paddle.x + game.paddle.width + game.ball.radius;

  if (paddleHit) {
    const relative = (game.ball.x - (game.paddle.x + game.paddle.width / 2)) / (game.paddle.width / 2);
    const speed = Math.min(720, Math.hypot(game.ball.vx, game.ball.vy) * 1.012);
    game.ball.vx = speed * Math.max(-0.82, Math.min(0.82, relative));
    game.ball.vy = -Math.sqrt(Math.max(1, speed * speed - game.ball.vx * game.ball.vx));
    game.ball.y = paddleTop - game.ball.radius - 1;
    events.push("paddle");
  }

  for (const brick of game.bricks) {
    if (brick.hp <= 0 || !circleHitsBrick(game.ball, brick)) continue;
    brick.hp -= 1;
    const wasOutsideX = previousX <= brick.x || previousX >= brick.x + brick.width;
    const wasOutsideY = previousY <= brick.y || previousY >= brick.y + brick.height;
    if (wasOutsideX && !wasOutsideY) game.ball.vx *= -1;
    else game.ball.vy *= -1;

    if (brick.hp === 0) {
      game.combo = game.comboTimer > 0 ? Math.min(game.combo + 1, 8) : 1;
      game.comboTimer = 2.4;
      game.score += 100 * game.level * game.combo;
      game.bricksBroken += 1;
      spawnParticles(game, brick);
    } else {
      game.score += 25 * game.level;
    }
    events.push("brick");
    break;
  }

  if (game.bricks.every((brick) => brick.hp <= 0)) {
    resetForNextLevel(game);
    events.push("level");
  }

  if (game.ball.y - game.ball.radius > GAME_HEIGHT) {
    game.lives -= 1;
    game.combo = 1;
    game.comboTimer = 0;
    if (game.lives <= 0) {
      game.status = "gameOver";
      game.ball.launched = false;
      events.push("gameOver");
    } else {
      dockBall(game);
      events.push("life");
    }
  }
  return events;
}
