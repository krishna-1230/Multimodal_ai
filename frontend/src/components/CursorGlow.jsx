"use client";

import { useEffect, useRef } from "react";

export default function CursorGlow({ className = "pointer-events-none fixed inset-0" }) {
  const glowRef = useRef(null);

  useEffect(() => {
    const element = glowRef.current;
    if (!element) return;
    const handlePointerMove = (event) => {
      element.style.setProperty("--x", `${event.clientX}px`);
      element.style.setProperty("--y", `${event.clientY}px`);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div
      ref={glowRef}
      className={className}
      style={{
        background:
          "radial-gradient(340px 340px at var(--x,50%) var(--y,50%), rgba(0,132,255,0.26), transparent 70%)",
        transition: "background 80ms linear",
        mixBlendMode: "screen",
      }}
    />
  );
}


