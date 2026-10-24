import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import type { ReactNode } from "react";
import { DeferredParticles } from "@/components/shared/particles";

/**
 * The whole page of a full-page state: the height of the screen, the state in
 * the middle of it, and the field of dots behind it. The field is only
 * decoration, so a field that cannot be loaded leaves the page as it is.
 */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center px-6 py-12">
      <ErrorBoundary fallback={null}>
        <DeferredParticles className="pointer-events-none absolute inset-0 opacity-80" />
      </ErrorBoundary>
      <div className="relative flex w-full justify-center">{children}</div>
    </main>
  );
}
