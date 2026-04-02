import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'blue' | 'mint' | 'amber' | 'rose';
};

const accentClasses: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'from-brand-500/20 to-transparent text-brand-50',
  mint: 'from-emerald-500/20 to-transparent text-emerald-50',
  amber: 'from-amber-500/20 to-transparent text-amber-50',
  rose: 'from-rose-500/20 to-transparent text-rose-50',
};

export function StatCard({ label, value, hint, accent = 'blue' }: StatCardProps): JSX.Element {
  return (
    <div className="app-panel relative overflow-hidden p-5">
      <div
        className={['absolute inset-0 bg-gradient-to-br opacity-80', accentClasses[accent]].join(
          ' ',
        )}
      />
      <div className="relative">
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
        <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-50">{value}</p>
        {hint ? <p className="mt-3 text-sm text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}
