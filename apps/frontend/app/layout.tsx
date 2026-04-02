import '@xyflow/react/dist/style.css';
import './globals.css';
import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';
import { AppShell } from '../components/app-shell';

export const metadata: Metadata = {
  title: 'RBAC Visualizer',
  description: 'Kubernetes RBAC Visualizer MVP scaffold',
};

export default function RootLayout({ children }: PropsWithChildren): JSX.Element {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
