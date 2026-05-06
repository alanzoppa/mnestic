"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const transition = {
  duration: 0.35,
  ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
        className="will-change-transform"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
