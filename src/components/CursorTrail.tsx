import { useEffect, useRef } from "react";

/**
 * Glowy laser-like cursor with a fading trail.
 * - Pointer-events: none, fixed full-screen canvas overlaid above all UI.
 * - Uses requestAnimationFrame; trail fades via low-alpha redraw.
 */
export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip on touch / coarse pointers
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    type Point = { x: number; y: number; life: number };
    const points: Point[] = [];
    const MAX_POINTS = 40;
    const LIFE = 1; // seconds

    let mouseX = -100;
    let mouseY = -100;
    let visible = false;
    let lastT = performance.now();

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      visible = true;
      points.push({ x: mouseX, y: mouseY, life: LIFE });
      if (points.length > MAX_POINTS) points.shift();
    };
    const onLeave = () => {
      visible = false;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave);
    window.addEventListener("resize", resize);

    let raf = 0;
    const render = (t: number) => {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      ctx.clearRect(0, 0, width, height);

      // Draw trail as connected glow segments
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(0, 229, 184, 0.55)";

      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const a = (p1.life / LIFE) * 0.55;
        if (a <= 0) continue;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = `rgba(0, 229, 184, ${a})`;
        ctx.lineWidth = 2 + (i / points.length) * 2;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }

      // Head dot
      if (visible) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(0, 229, 184, 0.8)";
        ctx.fillStyle = "rgba(180, 255, 235, 0.95)";
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;

      // Decay lives
      for (const p of points) p.life -= dt;
      while (points.length && points[0].life <= 0) points.shift();

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
        mixBlendMode: "screen",
      }}
    />
  );
}
