"use client";
import { useEffect, useRef, useState } from "react";
import type { RequestView } from "../lib/chain";
export default function Mechanism({ request }: { request?: RequestView }) {
  const host = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(false),
    [fallback, setFallback] = useState(false);
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    let dead = false,
      cleanup = () => {};
    const el = host.current;
    if (!el) return;
    void import("three")
      .then((T) => {
        if (dead) return;
        let renderer: import("three").WebGLRenderer;
        try {
          renderer = new T.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
          });
        } catch {
          setFallback(true);
          return;
        }
        setFallback(false);
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute("aria-hidden", "true");
        const scene = new T.Scene(),
          camera = new T.PerspectiveCamera(35, 1, 0.1, 100);
        camera.position.set(0, 0.6, 8.4);
        camera.lookAt(0, 0, 0);
        scene.add(new T.HemisphereLight(0xffffff, 0x303d38, 3));
        for (const [x, y, z] of [
          [3, 4, 5],
          [-4, 0, 2],
          [0, -4, 1],
        ]) {
          const light = new T.DirectionalLight(0xffffff, 5);
          light.position.set(x!, y!, z!);
          scene.add(light);
        }
        const group = new T.Group();
        scene.add(group);
        group.rotation.set(0.35, -0.45, -0.27);
        const metal = new T.MeshStandardMaterial({
          color: 0x99a7a6,
          metalness: 0.86,
          roughness: 0.24,
        });
        const edge = new T.MeshStandardMaterial({
          color: 0x63dcb0,
          metalness: 0.4,
          roughness: 0.26,
          emissive: 0x163c2c,
          emissiveIntensity: 0.6,
        });
        const rings = [];
        for (let i = 0; i < 2; i++) {
          const g = new T.Group();
          g.position.z = (i - 0.5) * 1.2;
          g.rotation.x = i ? 0.28 : -0.2;
          const mesh = new T.Mesh(
            new T.TorusGeometry(1.65, 0.19, 20, 100),
            metal,
          );
          g.add(mesh);
          g.add(new T.Mesh(new T.TorusGeometry(1.65, 0.035, 10, 100), edge));
          for (let j = 0; j < 12; j++) {
            const tick = new T.Mesh(new T.BoxGeometry(0.07, 0.13, 0.07), edge);
            tick.position.set(
              Math.cos((j * Math.PI) / 6) * 1.66,
              Math.sin((j * Math.PI) / 6) * 1.66,
              0.18,
            );
            tick.rotation.z = (j * Math.PI) / 6 - Math.PI / 2;
            g.add(tick);
          }
          group.add(g);
          rings.push(g);
        }
        const opening = request?.state === 3 || request?.state === 4;
        for (const direction of [-1, 1]) {
          const core = new T.Mesh(new T.BoxGeometry(0.65, 0.95, 0.85), metal);
          core.position.x = direction * (opening ? 0.65 : 0.335);
          group.add(core);
        }
        const inset = new T.Mesh(new T.BoxGeometry(0.1, 0.7, 0.9), edge);
        group.add(inset);
        if (request?.sourceOutcome === 1) rings[0]!.scale.setScalar(0.78);
        let frame = 0,
          visible = true;
        const render = () => {
          renderer.render(scene, camera);
        };
        const animate = (time: number) => {
          frame = 0;
          if (dead || paused || reduced || !visible || document.hidden) return;
          group.rotation.y = -0.45 + Math.sin(time / 7000) * 0.12;
          group.position.y = Math.sin(time / 2200) * 0.05;
          render();
          frame = requestAnimationFrame(animate);
        };
        const sync = () => {
          if (frame) cancelAnimationFrame(frame);
          frame = 0;
          render();
          if (!paused && !reduced && visible && !document.hidden)
            frame = requestAnimationFrame(animate);
        };
        const resize = new ResizeObserver(() => {
          if (dead) return;
          renderer.setSize(el.clientWidth, el.clientHeight);
          camera.aspect = el.clientWidth / el.clientHeight;
          camera.updateProjectionMatrix();
          render();
        });
        resize.observe(el);
        const observer = new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? false;
          sync();
        });
        observer.observe(el);
        document.addEventListener("visibilitychange", sync);
        const lost = (event: Event) => {
          event.preventDefault();
          setFallback(true);
          if (frame) cancelAnimationFrame(frame);
        };
        renderer.domElement.addEventListener("webglcontextlost", lost);
        sync();
        cleanup = () => {
          if (frame) cancelAnimationFrame(frame);
          resize.disconnect();
          observer.disconnect();
          document.removeEventListener("visibilitychange", sync);
          renderer.domElement.removeEventListener("webglcontextlost", lost);
          scene.traverse((o) => {
            if (o instanceof T.Mesh) o.geometry.dispose();
          });
          metal.dispose();
          edge.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => setFallback(true));
    return () => {
      dead = true;
      cleanup();
    };
  }, [paused, reduced, request?.state, request?.sourceOutcome]);
  return (
    <figure
      className="mechanism"
      data-testid="mechanism"
      data-motion={paused || reduced ? "still" : "animated"}
    >
      <div ref={host} className="canvas-host" aria-hidden="true" />
      {fallback && (
        <div className="static-mechanism" aria-hidden="true">
          <i />
          <i />
          <b />
        </div>
      )}
      <figcaption>
        <span>
          {request ? "Request-bound state" : "How settlement works"}
          <small>
            {request
              ? "The escrow opens only after a confirmed settlement."
              : "Explanatory mechanism. Not a live transaction."}
          </small>
        </span>
        <button onClick={() => setPaused(!paused)} aria-pressed={paused}>
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      </figcaption>
    </figure>
  );
}
