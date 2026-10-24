import { Schema } from "effect";
import { createStore } from "zustand";

/**
 * What the prompt of one question knows of its sync session: the client ID that the
 * server gave the session, and the version of the document the editor holds. The
 * subscription to the steps reads both, so it follows the session.
 */
const PromptSyncState = Schema.Struct({
  clientId: Schema.NullOr(Schema.String),
  version: Schema.Natural,
});

/** The actions that open the session and move it to a new version. */
interface PromptSyncActions {
  /** Moves the session to the version that the editor holds now. */
  readonly advance: (version: number) => void;
  /** Records the session once the server opened the document for it. */
  readonly open: (clientId: string, version: number) => void;
}

/** The state of one prompt's session, with its actions. */
export type PromptSync = typeof PromptSyncState.Type & PromptSyncActions;

/** Creates the session state of one prompt. Each prompt editor creates its own, once. */
export const createPromptSync = () =>
  createStore<PromptSync>()((set) => ({
    advance: (version) => set({ version }),
    clientId: null,
    open: (clientId, version) => set({ clientId, version }),
    version: 0,
  }));
