import type { PropsWithChildren, ReactNode } from 'react';
import { PageHeader } from './page-header';

type PageCardProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}>;

export function PageCard({
  eyebrow,
  title,
  description,
  aside,
  children,
}: PageCardProps): JSX.Element {
  return (
    <section className="space-y-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} aside={aside} />
      <div className="space-y-6">{children}</div>
    </section>
  );
}
