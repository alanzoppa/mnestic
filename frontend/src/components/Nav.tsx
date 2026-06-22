'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Search, BookOpen, Tag, BarChart3, Calendar, Zap, GitGraph, Plus, Settings } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/browse', label: 'Browse', icon: BookOpen },
  { href: '/tags', label: 'Tags', icon: Tag },
  { href: '/timeline', label: 'Timeline', icon: BarChart3 },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/graph', label: 'Graph', icon: Zap },
  { href: '/search-graph', label: 'Search Graph', icon: GitGraph },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface NavProps {
  onNavigate?: () => void;
}

export default function Nav({ onNavigate }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col w-64 min-h-screen bg-zinc-950 border-r border-zinc-800/60">
      {/* Logo / Brand */}
      <div className="p-6 border-b border-zinc-800/60">
        <Link href="/" className="flex items-center gap-3 group" onClick={onNavigate}>
            <img src="/mnestic.png" alt="Mnestic" width={40} height={40} className="rounded-xl transition-transform duration-200 group-hover:scale-105" />
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Mnestic</h1>
            <p className="text-xs text-zinc-500 font-medium">Semantic Browser</p>
          </div>
        </Link>
      </div>

      {/* New Note CTA */}
      <div className="px-3 pt-4 pb-2">
        <Link href="/create" onClick={onNavigate}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all duration-200 shadow-sm shadow-blue-900/20 active:scale-[0.98]">
          <Plus className="w-4 h-4" />
          New Note
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <NavLink
              key={item.href}
              href={item.href}
              icon={<item.icon className="w-5 h-5" strokeWidth={2} />}
              active={isActive}
              onNavigate={onNavigate}
            >
              {item.label}
            </NavLink>
          );
        })}
      </div>

      {/* Footer / Status */}
      <div className="p-4 border-t border-zinc-800/60">
        <div className="flex items-center gap-2.5 text-xs text-zinc-500 px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
          <span className="font-medium">System Ready</span>
        </div>
      </div>
    </nav>
  );
}

interface NavLinkProps {
  href: string;
  children: ReactNode;
  icon: ReactNode;
  active?: boolean;
  onNavigate?: () => void;
}

function NavLink({ href, children, icon, active, onNavigate }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
        ${active 
          ? 'bg-zinc-900/80 text-zinc-100 font-semibold' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'}
      `}
    >
      {/* Active indicator — left edge accent bar */}
      <motion.span
        layoutId="active-nav-indicator"
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-500 rounded-r-full"
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
      <span className={active ? 'text-blue-400' : 'text-zinc-500'}>{icon}</span>
      {children}
    </Link>
  );
}