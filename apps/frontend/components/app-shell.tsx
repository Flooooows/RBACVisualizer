'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', hint: 'Posture' },
  { href: '/imports', label: 'Imports', hint: 'Sources' },
  { href: '/graph', label: 'Graph', hint: 'Pathing' },
  { href: '/subjects', label: 'Subjects', hint: 'Identity' },
  { href: '/resources', label: 'Resources', hint: 'Access' },
  { href: '/anomalies', label: 'Anomalies', hint: 'Findings' },
];

export function AppShell({ children }: PropsWithChildren): JSX.Element {
  const pathname = usePathname();

  const activeItem = navItems.find((item) => item.href === pathname) ?? navItems[0];

  return (
    <div className="min-h-screen">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-[280px] md:flex-col md:bg-[#131b2e]/60 md:px-4 md:py-6 md:backdrop-blur-xl">
        <div className="mb-8 mt-14 px-2">
          <div className="flex items-center gap-3 rounded-xl bg-[#171f33] px-4 py-4 ring-1 ring-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00163a] text-[#adc6ff] ring-1 ring-white/10">
              ⬢
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">RBAC Visualizer</p>
              <p className="text-xs text-slate-400">Kubernetes access oversight</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group flex items-center justify-between rounded-lg px-4 py-3 transition',
                  active
                    ? 'border-r-2 border-[#adc6ff] bg-[#171f33] text-[#adc6ff]'
                    : 'text-slate-400 hover:bg-[#171f33] hover:text-slate-100',
                ].join(' ')}
              >
                <div>
                  <p className="text-sm font-medium tracking-tight">{item.label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-slate-500 group-hover:text-slate-400">
                    {item.hint}
                  </p>
                </div>
                <span
                  className={[
                    'h-2 w-2 rounded-full transition',
                    active
                      ? 'bg-brand-100 shadow-[0_0_18px_rgba(173,198,255,0.55)]'
                      : 'bg-slate-700 group-hover:bg-slate-500',
                  ].join(' ')}
                />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4">
          <div className="rounded-xl px-4 py-3 text-sm text-slate-400">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Current view</p>
            <p className="mt-2 font-semibold text-slate-100">{activeItem.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Manifest and cluster-first RBAC inspection.
            </p>
          </div>
        </div>
      </aside>

      <div className="md:pl-[280px]">
        <header className="fixed top-0 z-20 h-16 w-full border-b border-white/5 bg-[#131b2e] shadow-[0px_40px_40px_rgba(0,22,58,0.08)] md:w-[calc(100%-280px)]">
          <div className="flex h-full items-center justify-between gap-6 px-6 lg:px-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-brand-100/90 md:hidden">
                RBAC Visualizer
              </p>
              <span className="text-xl font-bold tracking-tighter text-[#adc6ff] md:hidden">
                RBAC Visualizer
              </span>
              <p className="hidden text-sm text-slate-500 md:block">
                Kubernetes / OpenShift RBAC inspection workspace
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden min-w-[260px] items-center rounded-lg bg-[#2d3449] px-4 py-2.5 ring-1 ring-white/5 lg:flex">
                <span className="mr-3 text-slate-500">⌕</span>
                <span className="text-sm text-slate-500">Search subjects, roles, bindings…</span>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.25em] text-emerald-100">
                Local analysis
              </div>
            </div>
          </div>
        </header>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/5 bg-[#131b2e]/95 px-3 py-2 backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-6 gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'rounded-lg px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.16em] transition',
                    active ? 'bg-[#171f33] text-[#adc6ff]' : 'text-slate-400 hover:bg-[#171f33]',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="px-6 pb-12 pt-24 lg:px-8">
          <div className="mx-auto max-w-7xl pb-20 md:pb-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
