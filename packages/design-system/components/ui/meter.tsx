/** A thin bar that shows how much of a whole is used or done, from none to the whole. */
export function Meter({
  label,
  percent,
}: {
  /** What the bar measures, for assistive technology. */
  label: string;
  /** How far along, from 0 to 100. */
  percent: number;
}) {
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className="bg-muted h-1 w-full overflow-hidden rounded-full"
      data-slot="meter"
      role="progressbar"
    >
      <div
        className="bg-primary h-full rounded-full"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
