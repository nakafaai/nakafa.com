"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import { useConvexConnectionState } from "convex/react";
import { Schema } from "effect";

import { useState } from "react";
import { useAuthSession } from "@/components/auth/session";
import { useConvexAuth } from "@/components/providers/convex";
import type { TryoutSetTableProps } from "@/components/tryout/catalog/table/table.client";
import type {
  TryoutSetListArgs,
  TryoutSetRow,
} from "@/components/tryout/catalog/table/types";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";

const EMPTY_ROWS: TryoutSetRow[] = [];

/** Encodes one comparison key as JSON text, so equal keys compare equal as strings. */
const encodeKey = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

function scope(
  args: Omit<TryoutSetListArgs, "paginationOpts">,
  viewer: string | null
) {
  return encodeKey([
    viewer,
    args.countryKey,
    args.examKey,
    args.locale,
    args.trackKey,
  ]);
}

function selectionKey(args: Omit<TryoutSetListArgs, "paginationOpts">) {
  return encodeKey([args.filter, args.sort.field, args.sort.direction]);
}

function requestKey(args: TryoutSetListArgs) {
  return encodeKey([selectionKey(args), args.paginationOpts.numItems]);
}

/** Retention is scoped to one principal and track, including while requests change. */
function useCommittedResult(
  bootstrap: TryoutSetTableProps["bootstrap"],
  activeScope: string,
  candidate: TryoutSetTableProps["bootstrap"] | undefined
) {
  const [committed, setCommitted] = useState<{
    scope: string;
    value: TryoutSetTableProps["bootstrap"] | undefined;
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
  const sessionViewer = useAuthSession((session) =>
    session.isPending ? undefined : session.userId
  );
  const isAuthLoading = useConvexAuth((auth) => auth.isLoading);
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const [viewer, setViewer] = useState(initial);
  const id = sessionViewer === undefined ? viewer : sessionViewer;
  if (sessionViewer !== undefined && sessionViewer !== viewer) {
    setViewer(sessionViewer);
  }
  return {
    id,
    ready:
      sessionViewer !== undefined &&
      !isAuthLoading &&
      isAuthenticated === (id !== null),
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
  bootstrap: TryoutSetTableProps["bootstrap"];
  request: Omit<TryoutSetListArgs, "paginationOpts">;
}) {
  const { id: activeViewer, ready } = useViewer(bootstrap.result.viewerId);
  const connection = useConvexConnectionState();
  const activeScope = scope(request, activeViewer);
  const selection = encodeKey([activeScope, selectionKey(request)]);
  const window = useResultWindow(selection);
  const size = window.size;

  const args = { ...request, paginationOpts: { cursor: null, numItems: size } };
  const query = useQuery(
    refs.public.tryouts.queries.sets.list,
    ready ? args : "skip"
  );
  // The canonical query hook returns pending, never stale success or error, for skip.
  const viewerMismatch =
    QueryResult.isSuccess(query) && query.value.viewerId !== activeViewer;
  const success =
    QueryResult.isSuccess(query) && query.value.viewerId === activeViewer;
  const current = useCommittedResult(
    bootstrap,
    viewerMismatch ? "unavailable" : activeScope,
    success ? { args, result: query.value } : undefined
  );

  const fulfilled =
    current !== undefined && requestKey(current.args) === requestKey(args);
  const offline =
    (connection.connectionCount > 0 || connection.connectionRetries > 0) &&
    !connection.isWebSocketConnected;
  const error = QueryResult.isFailure(query) || viewerMismatch;
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
