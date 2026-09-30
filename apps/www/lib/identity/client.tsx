"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { createContext, type ReactNode, use } from "react";
import { useAuthSession } from "@/components/auth/session";
import {
  type AccountRecord,
  toViewer,
  type Viewer,
} from "@/lib/identity/viewer";

export type { AccountRecord, Viewer } from "@/lib/identity/viewer";

/** The stored account row, named for the surfaces that take it as a prop. */
export type CurrentUser = AccountRecord;

/** The resolved account, its projection, and whether it is still resolving. */
export interface IdentityState {
  readonly account: AccountRecord | null;
  readonly isAuthenticated: boolean;
  readonly isPending: boolean;
  readonly viewer: Viewer | null;
}

const missingIdentity = Symbol("missing-identity");

const IdentityContext = createContext<IdentityState | typeof missingIdentity>(
  missingIdentity
);

const signedOutState: IdentityState = {
  account: null,
  isAuthenticated: false,
  isPending: false,
  viewer: null,
};

const pendingState: IdentityState = {
  account: null,
  isAuthenticated: false,
  isPending: true,
  viewer: null,
};

/** Narrows one account row into the shared identity state. */
function toIdentityState(account: AccountRecord): IdentityState {
  return {
    account,
    isAuthenticated: true,
    isPending: false,
    viewer: toViewer(account),
  };
}

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

function IdentityValueProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: IdentityState;
}) {
  return <IdentityContext value={value}>{children}</IdentityContext>;
}

/**
 * Resolves the account from the shared Better Auth session.
 *
 * The session is the one source of authentication truth, so the account query
 * runs only once a session exists and a signed-out visitor settles instead of
 * waiting forever. Mounted once at the app boundary.
 */
export function IdentityProvider({ children }: { children: ReactNode }) {
  const hasSession = useAuthSession(
    (session) => session.data?.session !== undefined
  );
  const isSessionPending = useAuthSession((session) => session.isPending);
  const query = useQuery(
    refs.public.auth.queries.getCurrentUser,
    hasSession ? {} : "skip"
  );
  if (QueryResult.isFailure(query)) {
    throw query.error;
  }
  const value = resolveIdentityState({
    account: QueryResult.isSuccess(query) ? query.value : null,
    hasSession,
    isSessionPending,
    isQueryPending: QueryResult.isLoading(query),
  });

  return (
    <IdentityValueProvider value={value}>{children}</IdentityValueProvider>
  );
}

/**
 * Reads one slice of the identity state for the current subtree.
 *
 * Identity comes from the session and account query during render, so it is
 * shared through a plain context: readers re-render when it changes, which
 * happens only as it resolves and when the account signs in or out.
 */
export function useViewer<T>(selector: (state: IdentityState) => T): T {
  const context = use(IdentityContext);
  if (context === missingIdentity) {
    throw new Error("useViewer must be used within an IdentityProvider");
  }
  return selector(context);
}
