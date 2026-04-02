type AsyncStateProps = {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyMessage?: string;
};

export function AsyncState({
  loading,
  error,
  empty = false,
  emptyMessage = 'No data available yet.',
}: AsyncStateProps): JSX.Element | null {
  if (loading) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  if (error) {
    return (
      <p className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200">
        {error}
      </p>
    );
  }

  if (empty) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
        {emptyMessage}
      </p>
    );
  }

  return null;
}
