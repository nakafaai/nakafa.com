"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import { useTryoutPart } from "@/components/tryout/providers/part-state";

/** Renders the focused tryout part route inside an app shell owned by part state. */
export function TryoutPartShellBoundary({ children }: { children: ReactNode }) {
  const isTryoutActive = useTryoutPart((state) => state.state.isTryoutActive);

  return <AppShell locked={isTryoutActive}>{children}</AppShell>;
}
