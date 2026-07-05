"use client";

import { AppShell } from "@/components/sidebar/app-shell";

/** Renders the shared app shell for the try-out route subtree. */
export function TryoutShell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
