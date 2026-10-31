import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useHydrated } from "@tanstack/react-router";
import type { ReactElement } from "react";

/**
 * What a school draws until its first page can. A school renders only in the browser, so its first
 * HTML is the root shell alone (ADR 0038 D2), which holds no route and draws its own spinner. The
 * first client render must match that shell, so it draws nothing here. Once the code runs the load
 * is already under way, so this frame stands at once, in the same place, and a slow phone never
 * sits on an empty screen.
 */
export function SchoolPending(): ReactElement | null {
  const hydrated = useHydrated();

  if (!hydrated) {
    return null;
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center">
      <Spinner className="text-muted-foreground" />
    </div>
  );
}
