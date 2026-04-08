"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import { useTryoutSet } from "@/components/tryout/providers/set-provider";

/** Renders the focused tryout set route inside an app shell owned by set state. */
export function TryoutSetRouteShell({ children }: { children: ReactNode }) {
  const isTryoutActive = useTryoutSet((state) => state.state.isTryoutActive);

  return <AppShell locked={isTryoutActive}>{children}</AppShell>;
}
