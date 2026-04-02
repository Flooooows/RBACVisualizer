type StatusChipProps = {
  tone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  children: string;
};

const toneClasses: Record<NonNullable<StatusChipProps['tone']>, string> = {
  default: 'border-slate-700 bg-slate-900/80 text-slate-200',
  info: 'border-brand-800 bg-brand-500/10 text-brand-100',
  success: 'border-emerald-800 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-800 bg-amber-500/10 text-amber-100',
  danger: 'border-rose-800 bg-rose-500/10 text-rose-100',
};

export function StatusChip({ tone = 'default', children }: StatusChipProps): JSX.Element {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.25em]',
        toneClasses[tone],
      ].join(' ')}
    >
      {children}
    </span>
  );
}
