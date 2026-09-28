import type { ReactNode } from "react";
import { FeaturesDithering } from "@/components/marketing/about/features.client";

/** Reuses the authenticated entry-page split layout across auth and onboarding. */
export function EntryShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-svh lg:h-svh lg:grid-cols-7">
      {children}
    </main>
  );
}

/** Owns the scrollable interactive side of an entry page. */
export function EntryShellPanel({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-3 flex min-h-svh flex-col gap-4 overflow-y-auto p-6 sm:p-12 lg:min-h-0">
      {children}
    </div>
  );
}

/** Aligns entry-page navigation and preference actions. */
export function EntryShellHeader({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between">{children}</div>;
}

/** Centers the primary entry action inside the left panel. */
export function EntryShellBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      {children}
    </div>
  );
}

/** Renders the existing theme-aware dithering on wide screens. */
export function EntryShellArtwork() {
  return (
    <div className="relative col-span-4 hidden lg:block">
      <FeaturesDithering />
    </div>
  );
}
