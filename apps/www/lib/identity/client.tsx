"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";
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

const IdentityContext = createContext<IdentityState | null>(null);

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
 * query that will never run, and a seeded account settles as ready even while
 * the session is still resolving.
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
  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

/**
 * Resolves the account from the shared Better Auth session.
 *
 * The session is the one source of authentication truth, so the account query
 * runs only once a session exists and a signed-out visitor settles instead of
 * waiting forever. Mounted once at the app boundary.
 */
export function IdentityProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending: isSessionPending } = useAuthSession();
  const hasSession = session?.session !== undefined;
  const query = useQueryWithStatus(
    api.auth.queries.getCurrentUser,
    hasSession ? {} : "skip"
  );
  const value = resolveIdentityState({
    account: query.isSuccess ? query.data : null,
    hasSession,
    isSessionPending,
    isQueryPending: query.isPending,
  });

  return (
    <IdentityValueProvider value={value}>{children}</IdentityValueProvider>
  );
}

/**
 * Resolves the account from a protected route's own request credential.
 *
 * A route that already validated its token seeds this, so the first client
 * paint carries the real account. `usePreloadedQuery` then keeps the seeded
 * value reactive, so the route never resolves the same account twice.
 */
export function SeededIdentityProvider({
  children,
  seed,
}: {
  children: ReactNode;
  seed: Preloaded<typeof api.auth.queries.getCurrentUser>;
}) {
  const account = usePreloadedQuery(seed);

  return (
    <IdentityValueProvider
      value={account === null ? signedOutState : toIdentityState(account)}
    >
      {children}
    </IdentityValueProvider>
  );
}

/**
 * Reads one slice of the identity state for the current subtree.
 *
 * Takes a selector so a consumer subscribes to a primitive instead of the
 * whole state, which would re-render it whenever any identity field changes.
 */
export function useViewer<T>(selector: (state: IdentityState) => T): T {
  const value = useContextSelector(IdentityContext, (context) => context);
  if (value === null) {
    throw new Error("useViewer must be used within an IdentityProvider");
  }
  return selector(value);
}

/**
 * Reads the resolved account row for contracts that still describe storage.
 *
 * Prefer `useViewer`. This stays for the settings forms, optimistic write
 * patches, and consent code whose own contracts read the stored fields.
 */
export function useAccount<T>(
  selector: (state: {
    readonly isAuthenticated: boolean;
    readonly isPending: boolean;
    readonly user: AccountRecord | null;
  }) => T
): T {
  return useViewer((state) =>
    selector({
      isAuthenticated: state.isAuthenticated,
      isPending: state.isPending,
      user: state.account,
    })
  );
}
