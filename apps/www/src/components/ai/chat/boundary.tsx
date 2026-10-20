import type { Ref } from "@confect/core";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { ClientOnly, useLocation } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";
import { lazy, Suspense } from "react";
import { readChatFailureKind } from "@/components/ai/chat/access";
import { useAnswerRetry } from "@/lib/convex/requery";

// The failure card holds the sign-in chain, which only a signed-out visitor who
// cannot read a chat needs. It loads when a card is needed, so the first
// JavaScript of every chat route does not carry it.
const ChatFailure = lazy(() =>
  import("@/components/ai/chat/failure").then((module) => ({
    default: module.ChatFailure,
  }))
);

/** The query whose failure a boundary shows, and the args that read it. */
interface ChatRead<Query extends Ref.AnyPublicQuery> {
  readonly args: Ref.Args<Query>;
  readonly ref: Query;
}

/**
 * The boundary of every chat surface. A failure shows the failure card in
 * place of the surface, and the card's retry runs the read again. The card's
 * code loads when the first failure of a page needs it, so that first failure
 * can show an empty surface until the code arrives. The boundary also tries
 * again when the route changes or one of `resetKeys` changes, so a card does
 * not stay over a page the learner has moved to.
 *
 * With `read`, the retry waits for the server's answer before the surface
 * remounts, so the remount does not read the failure that the cache still holds.
 * The card's retry button is disabled while that wait is open.
 */
export function ChatBoundary<Query extends Ref.AnyPublicQuery>({
  children,
  read,
  resetKeys = [],
}: PropsWithChildren<{
  read?: ChatRead<Query> | undefined;
  resetKeys?: readonly unknown[];
}>) {
  const pathname = useLocation({ select: (location) => location.pathname });

  // The card fills the surface it replaces, so it centres in a page whose
  // content is not a flex container, and in the sheet's flex column alike.
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="flex size-full min-h-0 flex-1 flex-col">
          {read ? (
            <ChatReadFailure
              error={error}
              read={read}
              reset={resetErrorBoundary}
            />
          ) : (
            <Suspense fallback={null}>
              <ClientOnly fallback={null}>
                <ChatFailure
                  kind={readChatFailureKind(error)}
                  onRetry={resetErrorBoundary}
                />
              </ClientOnly>
            </Suspense>
          )}
        </div>
      )}
      resetKeys={[pathname, ...resetKeys]}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * The failure card of a boundary that has `read`. Its retry waits for the
 * server's answer, then the surface remounts and reads the answer.
 */
function ChatReadFailure<Query extends Ref.AnyPublicQuery>({
  error,
  read,
  reset,
}: {
  error: unknown;
  read: ChatRead<Query>;
  reset: () => void;
}) {
  const { retry, waiting } = useAnswerRetry(read.ref, read.args, reset);
  return (
    <Suspense fallback={null}>
      <ClientOnly fallback={null}>
        <ChatFailure
          isPending={waiting}
          kind={readChatFailureKind(error)}
          onRetry={retry}
        />
      </ClientOnly>
    </Suspense>
  );
}
