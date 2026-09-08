"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useConvexAuth, useConvexConnectionState } from "convex/react";
import { useState } from "react";
import type {
  TryoutCatalogBootstrap,
  TryoutSetListArgs,
  TryoutSetRow,
} from "@/components/tryout/catalog/table/types";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";
import { authClient } from "@/lib/auth/client";

const EMPTY_ROWS: TryoutSetRow[] = [];

function scope(
  args: Omit<TryoutSetListArgs, "paginationOpts">,
  viewer: string | null
) {
  return JSON.stringify([
    viewer,
    args.countryKey,
    args.examKey,
    args.locale,
    args.trackKey,
  ]);
}

function selectionKey(args: Omit<TryoutSetListArgs, "paginationOpts">) {
  return JSON.stringify([args.filter, args.sort.field, args.sort.direction]);
}

function requestKey(args: TryoutSetListArgs) {
  return JSON.stringify([selectionKey(args), args.paginationOpts.numItems]);
}

/** Retention is scoped to one principal and track, including while requests change. */
function useCommittedResult(
  bootstrap: TryoutCatalogBootstrap,
  activeScope: string,
  candidate: TryoutCatalogBootstrap | undefined
) {
  const [committed, setCommitted] = useState<{
    scope: string;
    value: TryoutCatalogBootstrap | undefined;
  }>({
    scope: scope(bootstrap.args, bootstrap.result.viewerId),
    value: bootstrap,
  });
  if (committed.scope !== activeScope) {
    setCommitted({ scope: activeScope, value: candidate });
    return candidate;
  }
  if (candidate === undefined) {
    return committed.value;
  }
  if (committed.value?.result !== candidate.result) {
    setCommitted({ scope: activeScope, value: candidate });
  } else if (requestKey(committed.value.args) !== requestKey(candidate.args)) {
    setCommitted({ scope: activeScope, value: candidate });
  }
  return candidate;
}

/** Better Auth identifies the principal; Convex must finish switching before subscribing. */
function useViewer(initial: string | null) {
  const session = authClient.useSession();
  const auth = useConvexAuth();
  const [viewer, setViewer] = useState(initial);
  const sessionViewer =
    session.data?.user.id ?? (session.isPending ? undefined : null);
  const id = sessionViewer === undefined ? viewer : sessionViewer;
  if (sessionViewer !== undefined && sessionViewer !== viewer) {
    setViewer(sessionViewer);
  }
  return {
    id,
    ready:
      !(session.isPending || auth.isLoading) &&
      auth.isAuthenticated === (id !== null),
  };
}

/** Each selection starts a fresh prefix; only an explicit load extends it. */
function useResultWindow(selection: string) {
  const [window, setWindow] = useState({
    selection,
    size: TRYOUT_SET_PAGE_SIZE,
  });
  const size =
    window.selection === selection ? window.size : TRYOUT_SET_PAGE_SIZE;
  if (window.selection !== selection) {
    setWindow({ selection, size: TRYOUT_SET_PAGE_SIZE });
  }
  return {
    size,
    extend: () =>
      setWindow({
        selection,
        size: Math.min(size + TRYOUT_SET_PAGE_SIZE, TRYOUT_CATALOG_LIMIT),
      }),
  };
}

/**
 * Keeps one complete signed result visible until its replacement is ready.
 * A growing first-page subscription updates all visible rows in one transaction;
 * it never concatenates catalog revisions or restarts progress-bound cursors.
 */
export function useTryoutSetData({
  bootstrap,
  request,
}: {
  bootstrap: TryoutCatalogBootstrap;
  request: Omit<TryoutSetListArgs, "paginationOpts">;
}) {
  const { id: activeViewer, ready } = useViewer(bootstrap.result.viewerId);
  const connection = useConvexConnectionState();
  const activeScope = scope(request, activeViewer);
  const selection = JSON.stringify([activeScope, selectionKey(request)]);
  const window = useResultWindow(selection);
  const size = window.size;

  const args = { ...request, paginationOpts: { cursor: null, numItems: size } };
  const query = useQueryWithStatus(
    api.tryouts.queries.sets.list,
    ready ? args : "skip"
  );
  // The canonical query hook returns pending, never stale success or error, for skip.
  const viewerMismatch =
    query.isSuccess && query.data.viewerId !== activeViewer;
  const success = query.isSuccess && query.data.viewerId === activeViewer;
  const current = useCommittedResult(
    bootstrap,
    viewerMismatch ? "unavailable" : activeScope,
    success ? { args, result: query.data } : undefined
  );

  const fulfilled =
    current !== undefined && requestKey(current.args) === requestKey(args);
  const offline =
    (connection.connectionCount > 0 || connection.connectionRetries > 0) &&
    !connection.isWebSocketConnected;
  const error = query.isError || viewerMismatch;
  const busy = !(fulfilled || error);

  return {
    busy,
    hasMore: current !== undefined && !current.result.isDone,
    error,
    offline,
    rows: current?.result.page ?? EMPTY_ROWS,
    snapshotId: current?.result.snapshotId,
    loadMore: window.extend,
  };
}
