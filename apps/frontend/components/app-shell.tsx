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
      <aside className="hidden xl:fixed xl:inset-y-0 xl:left-0 xl:z-30 xl:flex xl:w-[304px] xl:flex-col xl:border-r xl:border-white/5 xl:bg-slate-950/60 xl:px-6 xl:py-7 xl:backdrop-blur-2xl">
        <div className="app-panel p-5">
          <p className="text-[11px] uppercase tracking-[0.35em] text-brand-100/90">
            RBAC Visualizer
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-50">
            Kubernetes RBAC control room
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Inspect subjects, bindings, roles, namespaces, and anomaly paths from manifests or a
            live cluster.
          </p>
        </div>

        <nav className="mt-6 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group flex items-center justify-between rounded-2xl px-4 py-3 transition',
                  active
                    ? 'bg-brand-500/12 text-slate-50 ring-1 ring-brand-100/20'
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-100',
                ].join(' ')}
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 group-hover:text-slate-400">
                    {item.hint}
                  </p>
                </div>
                <span
                  className={[
                    'h-2.5 w-2.5 rounded-full transition',
                    active
                      ? 'bg-brand-100 shadow-[0_0_18px_rgba(173,198,255,0.55)]'
                      : 'bg-slate-700 group-hover:bg-slate-500',
                  ].join(' ')}
                />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto app-panel-muted p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Current view</p>
          <p className="mt-3 text-lg font-semibold text-slate-100">{activeItem.label}</p>
          <p className="mt-2 text-sm text-slate-400">
            Kubernetes-first RBAC analysis, graph exploration, and import diagnostics.
          </p>
        </div>
      </aside>

      <div className="xl:pl-[304px]">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-6 py-4 lg:px-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-brand-100/90 xl:hidden">
                RBAC Visualizer
              </p>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-50">
                {activeItem.label}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Kubernetes / OpenShift RBAC inspection workspace
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden min-w-[260px] items-center rounded-full bg-slate-900/80 px-4 py-2.5 ring-1 ring-white/10 lg:flex">
                <span className="mr-3 text-slate-500">⌘K</span>
                <span className="text-sm text-slate-500">Search subjects, roles, bindings…</span>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.25em] text-emerald-100">
                Local analysis
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-6 py-8 lg:px-8">
          <div className="app-panel-muted min-h-[calc(100vh-8rem)] p-5 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
