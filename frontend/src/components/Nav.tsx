'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { LayoutGrid, Search, BookOpen, Tag, BarChart3, Calendar, Zap } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/browse', label: 'Browse', icon: BookOpen },
  { href: '/tags', label: 'Tags', icon: Tag },
  { href: '/timeline', label: 'Timeline', icon: BarChart3 },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/graph', label: 'Graph', icon: Zap },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col w-64 min-h-screen bg-zinc-950 border-r border-zinc-800/60">
      {/* Logo / Brand */}
      <div className="p-6 border-b border-zinc-800/60">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
            <Zap className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Notes</h1>
            <p className="text-xs text-zinc-500">Archive Browser</p>
          </div>
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
            >
              {item.label}
            </NavLink>
          );
        })}
      </div>

      {/* Footer / Status */}
      <div className="p-4 border-t border-zinc-800/60">
        <div className="card p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>System Ready</span>
          </div>
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
}

function NavLink({ href, children, icon, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
        ${active
          ? 'bg-gradient-to-r from-blue-600/20 to-blue-500/10 text-blue-400 border border-blue-500/30'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
        }
      `}
    >
      <span className={active ? 'text-blue-400' : 'text-zinc-500'}>{icon}</span>
      {children}
    </Link>
  );
}
