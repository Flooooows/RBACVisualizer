type PlaceholderListProps = {
  items: string[];
};

export function PlaceholderList({ items }: PlaceholderListProps): JSX.Element {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <li key={item} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
          {item}
        </li>
      ))}
    </ul>
  );
}
