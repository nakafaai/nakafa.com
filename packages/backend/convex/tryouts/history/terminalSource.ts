import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  historyRead,
  type TryoutHistoryError,
} from "@repo/backend/convex/tryouts/history/spec";
import type { TerminalHistoryPage } from "@repo/backend/convex/tryouts/history/terminalPage";
import type {
  TerminalFrozenPage,
  TerminalIdentityState,
  TerminalSignedState,
} from "@repo/backend/convex/tryouts/history/terminalState";
import { makeFunctionReference } from "convex/server";
import { Context, type Effect } from "effect";

const identitiesReference = makeFunctionReference<
  "query",
  Record<string, never>,
  TerminalIdentityState
>("tryouts/history/terminalState:identities");
const signedStateReference = makeFunctionReference<
  "query",
  Record<string, never>,
  TerminalSignedState
>("tryouts/history/terminalState:signedState");
const historyPageReference = makeFunctionReference<
  "query",
  { cursor: null | string },
  TerminalHistoryPage
>("tryouts/history/terminalPage:historyPage");
const frozenPageReference = makeFunctionReference<
  "query",
  { cursor: null | string },
  TerminalFrozenPage
>("tryouts/history/terminalState:frozenPage");

export interface TerminalHistorySourceService {
  readonly frozenPage: (
    cursor: null | string
  ) => Effect.Effect<TerminalFrozenPage, TryoutHistoryError>;
  readonly historyPage: (
    cursor: null | string
  ) => Effect.Effect<TerminalHistoryPage, TryoutHistoryError>;
  readonly identities: () => Effect.Effect<
    TerminalIdentityState,
    TryoutHistoryError
  >;
  readonly signedState: () => Effect.Effect<
    TerminalSignedState,
    TryoutHistoryError
  >;
}

export class TerminalHistorySource extends Context.Tag(
  "@repo/backend/tryouts/history/TerminalHistorySource"
)<TerminalHistorySource, TerminalHistorySourceService>() {}

/** Binds the terminal proof to its four bounded internal read Interfaces. */
export function makeLiveTerminalHistorySource(
  ctx: ActionCtx
): TerminalHistorySourceService {
  return {
    frozenPage: (cursor) =>
      historyRead("Unable to load a terminal frozen page.", () =>
        ctx.runQuery(frozenPageReference, { cursor })
      ),
    historyPage: (cursor) =>
      historyRead("Unable to load a terminal history page.", () =>
        ctx.runQuery(historyPageReference, { cursor })
      ),
    identities: () =>
      historyRead("Unable to load terminal identities.", () =>
        ctx.runQuery(identitiesReference, {})
      ),
    signedState: () =>
      historyRead("Unable to load terminal signed state.", () =>
        ctx.runQuery(signedStateReference, {})
      ),
  };
}
