"use client";

import { Copy } from "lucide-react";
import { ReactNode, useCallback, useRef, useState } from "react";

interface CopyButtonProps {
  text: string;
  className?: string;
  children?: ReactNode;
}

export function CopyButton({ text, className = "", children }: CopyButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(text);

    if (timerRef.current) clearTimeout(timerRef.current);

    setShowTooltip(true);

    timerRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 1500);
  }, [text]);

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-neutral-200"
        aria-label="Copy to clipboard"
      >
        {children ?? <Copy size={14} />}
      </button>

      <span
        className={`
          absolute left-1/2 -translate-x-1/2 top-full mt-1.5
          text-xs text-neutral-200 bg-neutral-800 px-2 py-1 rounded whitespace-nowrap
          pointer-events-none z-10
          transition-all duration-200
          ${showTooltip ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          ${typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "[transition:none]"
            : ""}
        `}
      >
        Copied!
      </span>
    </div>
  );
}