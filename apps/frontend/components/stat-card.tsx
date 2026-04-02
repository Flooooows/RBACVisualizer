import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'blue' | 'mint' | 'amber' | 'rose';
};

const accentClasses: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'border-[#adc6ff]/30 bg-[#131b2e] text-brand-50',
  mint: 'border-emerald-500/20 bg-[#131b2e] text-emerald-50',
  amber: 'border-amber-500/20 bg-[#131b2e] text-amber-50',
  rose: 'border-rose-500/20 bg-[#131b2e] text-rose-50',
};

export function StatCard({ label, value, hint, accent = 'blue' }: StatCardProps): JSX.Element {
  return (
    <div className={['rounded-xl border p-5', accentClasses[accent]].join(' ')}>
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
        <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-50">{value}</p>
        {hint ? <p className="mt-3 text-sm text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}
