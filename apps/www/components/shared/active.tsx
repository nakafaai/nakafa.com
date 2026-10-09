import { cn } from "cn";

/**
 * Marks the selected option of a menu with a dot at the end of its row. The
 * dot keeps its place while hidden, so the label layout and the hit target of
 * the row do not change with the selection.
 */
export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "my-px mr-px ml-auto size-2.5 shrink-0 rounded-full bg-primary opacity-0 transition-opacity",
        isActive && "opacity-100"
      )}
    />
  );
}
