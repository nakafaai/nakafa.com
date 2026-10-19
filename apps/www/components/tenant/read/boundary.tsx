"use client";

import type { Ref } from "@confect/core";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
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
 * A paginated read has no such retry, so a boundary without `read` retries by
 * loading the page again. A refusal that the viewer has lost the school's access
 * is not this part's to show: the boundary rethrows it to the school's own
 * boundary, which shows the refused page. A refusal of this part alone shows its own sentence, with no
 * Try again. `fallback` lays the failure out inside
 * the page's own frame, so a page keeps its header while its read fails.
 */
export function ReadBoundary<Query extends Ref.AnyPublicQuery>({
  children,
  fallback,
  read,
}: {
  children: ReactNode;
  fallback?: (failure: ReactNode) => ReactNode;
  read?: TenantRead<Query> | undefined;
}) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => {
        const failure =
          read === undefined ? (
            <PageFailure error={error} />
          ) : (
            <ReadFailure error={error} read={read} reset={resetErrorBoundary} />
          );
        return fallback === undefined ? failure : fallback(failure);
      }}
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
  if (isDenied(error)) {
    return <DeniedPart />;
  }
  return <DataFailure isPending={waiting} onRetry={retry} />;
}

/** The failure part of a paginated read, whose Try again loads the page again. */
function PageFailure({ error }: { error: unknown }) {
  if (isLostAccess(error)) {
    throw error;
  }
  if (isDenied(error)) {
    return <DeniedPart />;
  }
  return <DataFailure onRetry={reloadPage} />;
}

/**
 * The part of a page that the viewer may not open. Its one sentence has no Try again, because the
 * server refuses the same read again; a viewer who loses the school's access is sent to the refused
 * page by the school's own boundary.
 */
function DeniedPart() {
  const t = useTranslations("Common");
  return (
    <p className="p-4 text-muted-foreground text-sm">{t("part-denied")}</p>
  );
}
