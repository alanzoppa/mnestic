"use client";

import { useEffect, useRef } from "react";

const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];

export function KonamiDetector() {
  const indexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const expected = KONAMI_CODE[indexRef.current];

      if (e.code === expected) {
        indexRef.current += 1;

        if (indexRef.current === KONAMI_CODE.length) {
          indexRef.current = 0;
          showToast();
        }
      } else {
        indexRef.current = e.code === KONAMI_CODE[0] ? 1 : 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function showToast() {
    const existing = document.getElementById("konami-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "konami-toast";
    toast.textContent = "You found the secret. 2260 notes and counting.";
    toast.className =
      "fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-medium shadow-xl animate-toast-in";
    document.body.appendChild(toast);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      toast.classList.remove("animate-toast-in");
      toast.classList.add("animate-toast-out");
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  return null;
}