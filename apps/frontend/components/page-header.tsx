import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, aside }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.35em] text-brand-100/90">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
          {description}
        </p>
      </div>
      {aside ? <div className="min-w-[220px] self-stretch lg:self-start">{aside}</div> : null}
    </div>
  );
}
