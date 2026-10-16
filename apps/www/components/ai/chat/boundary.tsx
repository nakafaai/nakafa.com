"use client";

import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

// The failure card holds the sign-in chain, which only a signed-out visitor who
// cannot read a chat needs. It loads when a card is needed, so the first
// JavaScript of every chat route does not carry it.
const ChatFailure = dynamic(
  () =>
    import("@/components/ai/chat/failure").then((module) => module.ChatFailure),
  { loading: () => null, ssr: false }
);

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
