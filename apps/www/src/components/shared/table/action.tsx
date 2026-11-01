import { Button } from "@repo/design-system/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

/**
 * The one labelled action of a table row, at the row's end. On a phone its name folds away and its icon stays, so the
 * row's data keeps the room that a sticky button would cover. A row with several actions keeps its menu instead.
 */
export function TableAction(props: ComponentProps<typeof Button>) {
  return (
    <div className="flex justify-end">
      <Button
        className="max-sm:size-8 max-sm:has-[>svg]:px-0"
        size="sm"
        variant="outline"
        {...props}
      />
    </div>
  );
}

/** The name of a row's action, which on a phone only assistive technology reads. */
export function TableActionName({ children }: { children: ReactNode }) {
  return <span className="max-sm:sr-only">{children}</span>;
}
