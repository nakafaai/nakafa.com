"use client";

import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { ChatFailure } from "@/components/ai/chat/failure";

/**
 * The boundary of every chat surface. A failure shows the failure card in
 * place of the surface, never an empty one, and the card's retry runs the read
 * again. The boundary also tries again when the route changes or one of
 * `resetKeys` changes, so a card does not stay over a page the learner has
 * moved to.
 */
export function ChatBoundary({
  children,
  resetKeys = [],
}: PropsWithChildren<{ resetKeys?: readonly unknown[] }>) {
  const pathname = usePathname();

  // The card fills the surface it replaces, so it centres in a page whose
  // content is not a flex container, and in the sheet's flex column alike.
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="flex size-full min-h-0 flex-1 flex-col">
          <ChatFailure error={error} onRetry={resetErrorBoundary} />
        </div>
      )}
      resetKeys={[pathname, ...resetKeys]}
    >
      {children}
    </ErrorBoundary>
  );
}
