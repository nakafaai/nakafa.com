import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useHydrated } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import type { ReactElement } from "react";

/**
 * The spinner of a school's first load. In the first HTML it fades in late, so a fast load never
 * sees it. Once the code runs the load is already under way, so it stands at once, and the frame
 * never blinks between the two.
 */
const pendingSpinner = cva("text-muted-foreground", {
  variants: {
    hydrated: {
      false:
        "motion-safe:animate-in motion-safe:fade-in fill-mode-backwards delay-500",
      true: "",
    },
  },
});

/**
 * What a school draws until its first page can. A school renders only in the browser, so this frame
 * is the one thing the first HTML paints: the page's background and the spinner, so a slow phone
 * never sits on an empty screen.
 */
export function SchoolPending(): ReactElement {
  const hydrated = useHydrated();

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center">
      <Spinner className={pendingSpinner({ hydrated })} />
    </div>
  );
}
