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
    return (
      <div className="rounded-xl border border-white/5 bg-[#131b2e] px-4 py-4 text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-rose-800/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        {error}
      </p>
    );
  }

  if (empty) {
    return (
      <p className="rounded-xl border border-white/5 bg-[#131b2e] p-4 text-sm text-slate-300">
        {emptyMessage}
      </p>
    );
  }

  return null;
}
