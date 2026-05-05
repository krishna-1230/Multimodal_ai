"use client";

import { useEffect, useMemo, useState } from "react";
import { initParticlesEngine, Particles } from "@tsparticles/react";
import { loadFull } from "tsparticles";

export default function ParticlesBackground({
  id = "global-particles",
  className = "pointer-events-none fixed inset-0",
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  const particleOptions = useMemo(
    () => ({
      background: { color: "transparent" },
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: { value: 80, density: { enable: true, area: 900 } },
        color: { value: "#0084ff" },
        links: { enable: true, color: "#0084ff", distance: 140, opacity: 0.32, width: 2 },
        move: { enable: true, speed: 0.6, direction: "none", outModes: { default: "out" } },
        opacity: { value: 0.6 },
        size: { value: { min: 2, max: 4 } },
        shape: { type: "circle" },
      },
      interactivity: {
        events: { onHover: { enable: true, mode: "repulse" }, onClick: { enable: true, mode: "push" }, resize: true },
        modes: { repulse: { distance: 120, duration: 0.3 }, push: { quantity: 2 } },
      },
    }),
    []
  );

  if (!ready) return null;

  return (
    <div className={className}>
      <Particles id={id} options={particleOptions} />
    </div>
  );
}


