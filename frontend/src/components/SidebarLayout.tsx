'use client';

import { useCallback, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Nav from './Nav';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  // close on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, closeSidebar]);

  // prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen">
      {/* mobile toggle */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
        aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        data-testid="mobile-nav-toggle"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          data-testid="mobile-nav-backdrop"
        />
      )}

      {/* sidebar */}
      <aside
        className={`
          fixed lg:static top-0 left-0 z-50 h-full w-64 min-h-screen bg-zinc-950 border-r border-zinc-800/60
          transition-transform duration-300 ease-in-out
          -translate-x-full lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : ''}
        `}
      >
        <Nav onNavigate={closeSidebar} />
      </aside>

      {/* main content */}
      <main
        className="flex-1 p-6 pt-16 lg:pt-6 overflow-auto"
        data-testid="main-content"
      >
        {children}
      </main>
    </div>
  );
}
