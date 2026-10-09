"use client";

import { QueryResult, useQuery } from "@confect/react";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { useAuthSession } from "@/components/auth/session";
import { type AccountRecord, toViewer } from "@/lib/identity/viewer";

export type { AccountRecord, Viewer } from "@/lib/identity/viewer";

/** The stored account row, named for the surfaces that take it as a prop. */
export type CurrentUser = AccountRecord;

const signedOutState = {
  account: null,
  isAuthenticated: false,
  isPending: false,
  viewer: null,
};

const pendingState = {
  account: null,
  isAuthenticated: false,
  isPending: true,
  viewer: null,
};

/** Narrows one account row into the shared identity state. */
function toIdentityState(account: AccountRecord) {
  return {
    account,
    isAuthenticated: true,
    isPending: false,
    viewer: toViewer(account),
  };
}

/** The resolved account, its projection, and whether it is still resolving. */
type IdentityState =
  | typeof pendingState
  | typeof signedOutState
  | ReturnType<typeof toIdentityState>;

/**
 * Resolves identity from the session and its account query.
 *
 * A visitor with no session settles as signed out instead of waiting on a
 * query that will never run.
 */
function resolveIdentityState({
  account,
  hasSession,
  isSessionPending,
  isQueryPending,
}: {
  readonly account: AccountRecord | null;
  readonly hasSession: boolean;
  readonly isSessionPending: boolean;
  readonly isQueryPending: boolean;
}): IdentityState {
  if (account !== null) {
    return toIdentityState(account);
  }

  if (isSessionPending || (hasSession && isQueryPending)) {
    return pendingState;
  }

  return signedOutState;
}

/**
 * Reads one slice of the viewer's identity.
 *
 * Each reader derives identity from the shared session store and the account
 * query, which Convex serves from one subscription for every reader. No
 * provider shares the result: a provider value that changes after hydration
 * makes React discard streamed Suspense boundaries that are still pending,
 * and the session store gives a reader that hydrates late the pending
 * identity the server rendered. A visitor with no session settles as signed
 * out instead of waiting on a query that will never run.
 */
export function useViewer<T>(selector: (state: IdentityState) => T): T {
  const sessionId = useAuthSession((session) => session.sessionId);
  const isSessionPending = useAuthSession((session) => session.isPending);
  const query = useQuery(
    auth.queries.getCurrentUser,
    sessionId === null ? "skip" : {}
  );
  if (QueryResult.isFailure(query)) {
    throw query.error;
  }
  return selector(
    resolveIdentityState({
      account: QueryResult.isSuccess(query) ? query.value : null,
      hasSession: sessionId !== null,
      isSessionPending,
      isQueryPending: QueryResult.isLoading(query),
    })
  );
}
