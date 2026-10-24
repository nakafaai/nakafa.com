import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Link } from "@repo/internationalization/src/link";
import { useTenant } from "@/components/tenant/context";
import type { CellSpan } from "@/components/tenant/home/cells";

/**
 * One number of the strip at the top of a staff home, as a cell that links to the exams list, where the rooms, results
 * and drafts it counts live. Its number is a count, which the caller builds, and its span is one of the four shares
 * of the strip.
 */
export function MetricCell({
  count,
  period,
  span,
  title,
}: {
  count: string;
  period: string;
  span: CellSpan;
  title: string;
}) {
  const { slug } = useTenant();

  return (
    <Dashboard.Cell
      narrow={span.narrow}
      render={<Link params={{ slug }} to="/school/$slug/exams" />}
      wide={span.wide}
    >
      <Dashboard.CellHeader title={title} />
      <Dashboard.Value>{count}</Dashboard.Value>
      <Dashboard.Period>{period}</Dashboard.Period>
    </Dashboard.Cell>
  );
}
