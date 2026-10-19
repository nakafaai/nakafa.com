"use client";

import type { Ref } from "@confect/core";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import type { ReactNode } from "react";
import { DataFailure } from "@/components/shared/failure";
import { isLostAccess } from "@/components/tenant/refusal";
import { useAnswerRetry } from "@/lib/convex/retry.client";

/** The query that a boundary reads again when its Try again runs, and the args that read it. */
interface TenantRead<Query extends Ref.AnyPublicQuery> {
  readonly args: Ref.Args<Query>;
  readonly ref: Query;
}

/**
 * Keeps the failure of one read inside the part of the page that reads it: one
 * sentence with Try again, while the rest of the page keeps working. Try again
 * waits for the server's answer and then runs the read again, so the part reads
 * that answer and not the failure the cache still holds. The readers inside the
 * boundary must all unmount on a failure, because a query with a mounted reader
 * is not asked again.
 *
 * A refusal that the viewer has lost the school's access is not this part's to
 * show. The boundary rethrows it to the school's own boundary, which shows the
 * refused page. `fallback` lays the failure out inside the page's own frame, so a
 * page keeps its header while its read fails.
 */
export function ReadBoundary<Query extends Ref.AnyPublicQuery>({
  children,
  fallback = (failure) => failure,
  read,
}: {
  children: ReactNode;
  fallback?: (failure: ReactNode) => ReactNode;
  read: TenantRead<Query>;
}) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) =>
        fallback(
          <ReadFailure error={error} read={read} reset={resetErrorBoundary} />
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * The failure part of a read. Its Try again remounts the part that read, once
 * the server has answered the read again.
 */
function ReadFailure<Query extends Ref.AnyPublicQuery>({
  error,
  read,
  reset,
}: {
  error: unknown;
  read: TenantRead<Query>;
  reset: () => void;
}) {
  const { retry, waiting } = useAnswerRetry(read.ref, read.args, reset);
  if (isLostAccess(error)) {
    throw error;
  }
  return <DataFailure isPending={waiting} onRetry={retry} />;
}
