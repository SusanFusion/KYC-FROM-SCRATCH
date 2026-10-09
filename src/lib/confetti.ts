// A small, dependency-free confetti engine (canvas 2D) used by the Rankings
// page's top-3 celebration. No library to install: particles are launched
// upward from a point, fall under gravity with a little air drag and a
// paper-like flutter, fade out at the end, and the loop stops on its own once
// every piece is gone. Kept free of React so it can be tested on its own.

export interface ConfettiBurst {
  /** Viewport x/y (px) the pieces shoot out from. */
  x: number;
  y: number;
  /** Milliseconds after start() before this burst fires. */
  delay: number;
  count: number;
  colors: string[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  tilt: number;
  tiltSpeed: number;
  round: boolean;
  age: number;
  maxAge: number;
}

const GRAVITY = 0.28; // px per frame^2 (at 60fps)
const DRAG = 0.97; // per-frame velocity kept -> gentle terminal velocity
const FADE_START = 0.7; // fraction of its life a piece is fully opaque

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Runs the bursts on `canvas` (which should cover the viewport). Returns a
 *  function that stops everything immediately. `onDone` fires once all
 *  pieces have faded out (not when stopped early). */
export function runConfetti(canvas: HTMLCanvasElement, bursts: ConfettiBurst[], onDone?: () => void): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    onDone?.();
    return () => undefined;
  }

  let width = 0;
  let height = 0;
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  window.addEventListener("resize", fit);

  const pending = [...bursts].sort((a, b) => a.delay - b.delay);
  const particles: Particle[] = [];
  let cancelled = false;
  let raf = 0;
  const start = performance.now();
  let last = start;

  function spawn(b: ConfettiBurst) {
    for (let i = 0; i < b.count; i++) {
      // Mostly upward, fanned out ~±72 degrees either side of straight up.
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = rand(7, 17);
      particles.push({
        x: b.x + rand(-12, 12),
        y: b.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rand(6, 11),
        color: b.colors[Math.floor(Math.random() * b.colors.length)] ?? "#f59e0b",
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.25, 0.25),
        tilt: rand(0, Math.PI * 2),
        tiltSpeed: rand(0.08, 0.28),
        round: Math.random() < 0.25,
        age: 0,
        maxAge: rand(2600, 4200),
      });
    }
  }

  function finish(natural: boolean) {
    cancelled = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", fit);
    ctx!.clearRect(0, 0, width, height);
    if (natural) onDone?.();
  }

  function frame(now: number) {
    if (cancelled) return;
    const dt = Math.min((now - last) / 16.667, 3);
    last = now;
    const elapsed = now - start;

    while (pending.length > 0 && pending[0]!.delay <= elapsed) spawn(pending.shift()!);

    ctx!.clearRect(0, 0, width, height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.age += dt * 16.667;
      p.vy += GRAVITY * dt;
      p.vx *= Math.pow(DRAG, dt);
      p.vy *= Math.pow(DRAG, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.tilt += p.tiltSpeed * dt;

      if (p.age >= p.maxAge || p.y > height + 24) {
        particles.splice(i, 1);
        continue;
      }
      const lifeFrac = p.age / p.maxAge;
      const alpha = lifeFrac > FADE_START ? 1 - (lifeFrac - FADE_START) / (1 - FADE_START) : 1;

      ctx!.save();
      ctx!.globalAlpha = Math.max(0, alpha);
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.scale(1, Math.abs(Math.cos(p.tilt)) * 0.9 + 0.1); // flutter: the piece "turns" edge-on
      ctx!.fillStyle = p.color;
      if (p.round) {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx!.restore();
    }

    if (pending.length === 0 && particles.length === 0) {
      finish(true);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
  return () => {
    if (!cancelled) finish(false);
  };
}
