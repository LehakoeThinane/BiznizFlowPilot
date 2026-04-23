interface MetricsCardProps {
  label: string;
  value: number | string;
}

export function MetricsCard({ label, value }: MetricsCardProps) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}
