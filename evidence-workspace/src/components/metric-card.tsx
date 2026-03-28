type MetricCardProps = {
  label: string;
  value: string | number;
  detail?: string;
};

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <div className="group rounded-[1.75rem] border border-[var(--line)] bg-white/85 p-5 shadow-[0_20px_60px_-40px_rgba(30,22,21,0.55)] transition-transform duration-200 hover:-translate-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-ink)]">{label}</p>
      <p className="mt-4 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">{value}</p>
      {detail ? <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">{detail}</p> : null}
    </div>
  );
}
