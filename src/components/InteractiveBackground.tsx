import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";

/**
 * Full-screen fixed canvas background.
 * Dark mode → Plexus particles connecting near the cursor (neon teal).
 * Light mode → Drifting low-opacity geometric shapes over a soft mesh gradient.
 */
export function InteractiveBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999, active: false };

    type Particle = { x: number; y: number; vx: number; vy: number };
    type Shape = { x: number; y: number; r: number; vx: number; vy: number; kind: 0 | 1 | 2; rot: number; vr: number };

    let particles: Particle[] = [];
    let shapes: Shape[] = [];

    function resize() {
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(110, Math.floor((w * h) / 14000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
      }));

      const sCount = Math.min(14, Math.floor((w * h) / 90000));
      shapes = Array.from({ length: sCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 60 + Math.random() * 180,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        kind: Math.floor(Math.random() * 3) as 0 | 1 | 2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.002,
      }));
    }

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }
    function onLeave() { mouse.active = false; mouse.x = -9999; mouse.y = -9999; }

    function drawDark(w: number, h: number) {
      const teal = "0, 229, 184";
      // particles
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dm = Math.hypot(dx, dy);
        const near = mouse.active && dm < 160;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, near ? 1.8 : 1.2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${teal}, ${near ? 0.9 : 0.45})`;
        ctx!.fill();
      }
      // links
      const max = 130;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < max) {
            const alpha = (1 - d / max) * 0.18;
            ctx!.strokeStyle = `rgba(${teal}, ${alpha})`;
            ctx!.lineWidth = 0.6;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
        // cursor links (plexus emphasis)
        if (mouse.active) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 200) {
            const alpha = (1 - d / 200) * 0.55;
            ctx!.strokeStyle = `rgba(${teal}, ${alpha})`;
            ctx!.lineWidth = 0.8;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(mouse.x, mouse.y);
            ctx!.stroke();
          }
        }
      }
    }

    function drawLight(w: number, h: number) {
      // soft mesh gradient blobs
      const blobs = [
        { x: w * 0.2, y: h * 0.3, c: "rgba(0, 200, 170, 0.10)" },
        { x: w * 0.8, y: h * 0.2, c: "rgba(120, 160, 255, 0.10)" },
        { x: w * 0.6, y: h * 0.85, c: "rgba(255, 180, 200, 0.10)" },
      ];
      for (const b of blobs) {
        const g = ctx!.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(w, h) * 0.45);
        g.addColorStop(0, b.c);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, w, h);
      }

      // drifting geometric shapes
      const cursorPull = mouse.active ? 1 : 0;
      for (const s of shapes) {
        s.x += s.vx + (mouse.x - s.x) * 0.0002 * cursorPull;
        s.y += s.vy + (mouse.y - s.y) * 0.0002 * cursorPull;
        s.rot += s.vr;
        if (s.x < -s.r) s.x = w + s.r;
        if (s.x > w + s.r) s.x = -s.r;
        if (s.y < -s.r) s.y = h + s.r;
        if (s.y > h + s.r) s.y = -s.r;

        ctx!.save();
        ctx!.translate(s.x, s.y);
        ctx!.rotate(s.rot);
        ctx!.strokeStyle = "rgba(15, 23, 42, 0.08)";
        ctx!.fillStyle = "rgba(15, 23, 42, 0.025)";
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        if (s.kind === 0) {
          // circle
          ctx!.arc(0, 0, s.r, 0, Math.PI * 2);
        } else if (s.kind === 1) {
          // square
          ctx!.rect(-s.r / 2, -s.r / 2, s.r, s.r);
        } else {
          // triangle
          const r = s.r / 1.6;
          ctx!.moveTo(0, -r);
          ctx!.lineTo(r, r);
          ctx!.lineTo(-r, r);
          ctx!.closePath();
        }
        ctx!.fill();
        ctx!.stroke();
        ctx!.restore();
      }
    }

    function tick() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx!.clearRect(0, 0, w, h);
      if (themeRef.current === "dark") drawDark(w, h);
      else drawLight(w, h);
      raf = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}
