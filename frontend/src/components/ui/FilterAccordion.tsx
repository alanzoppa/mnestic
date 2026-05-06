"use client";

import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface FilterAccordionProps {
  isOpen: boolean;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FilterAccordion({
  isOpen,
  title,
  children,
  className = "",
}: FilterAccordionProps) {
  return (
    <div className={`rounded-lg overflow-hidden ${className}`}>
      <div
        data-testid="filter-panel"
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
      >
        <span className="text-sm font-semibold text-gray-200">{title}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </motion.span>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
