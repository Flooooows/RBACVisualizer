import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, aside }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.35em] text-brand-100/90">{eyebrow}</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-50 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
          {description}
        </p>
      </div>
      {aside ? <div className="min-w-[220px] self-stretch lg:self-start">{aside}</div> : null}
    </div>
  );
}
