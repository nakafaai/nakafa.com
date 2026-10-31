import type { ReactElement } from "react";

/**
 * What a school draws until its first page can, once its code runs: the frame that the empty stage
 * draws before any script (`DrawerStage`), at the same place and size, so the mark never moves and the
 * loader never blinks between the two.
 */
export function SchoolPending(): ReactElement {
  return (
    <div className="bg-background fixed inset-0 grid place-items-center">
      <img
        alt=""
        className="col-start-1 row-start-1 size-12 -translate-y-5 rounded-xl"
        height={48}
        src="/logo.svg"
        width={48}
      />
      <span className="border-muted-foreground col-start-1 row-start-1 size-6 translate-y-8 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  );
}
