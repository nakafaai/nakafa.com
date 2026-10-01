"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import type { PlayerMode } from "@/components/player/mode";
import type {
  PlayerResponseSpec,
  PlayerResponses,
  PlayerSelection,
} from "@/components/player/response";
import { createPlayerStore, type PlayerView } from "@/components/player/store";

/** One question of an attempt, with actions bound to its own placement. */
export interface PlayerQuestion {
  readonly answer: (selection: PlayerSelection | null) => void;
  readonly answered: boolean;
  readonly flag: (flagged: boolean) => void;
  readonly flagged: boolean;
  /** Stable placement key, used for DOM ids and navigation. */
  readonly key: string;
  /** 1-based position in the frozen order. */
  readonly number: number;
  readonly responseSpec: PlayerResponseSpec;
  readonly selection: PlayerSelection | null;
}

/** Live attempt state a provider derives from its server data. */
export interface PlayerState {
  /** Responses and flags are read-only: time ran out or finishing. */
  readonly locked: boolean;
  readonly questions: readonly PlayerQuestion[];
}

/** Attempt-wide actions a provider implements. */
export interface PlayerActions {
  /** Finishes in a transition; repeated calls are ignored. */
  readonly finish: () => void;
  /** Warms the destination when the learner shows intent to finish. */
  readonly prepareFinish: () => void;
}

/** Static facts about the attempt. */
export interface PlayerMeta {
  readonly backHref: string;
  /** A mode the assessment enforces; the view toggle hides when set. */
  readonly lock: PlayerMode | null;
  readonly responses: PlayerResponses;
  readonly title: string;
}

/** The interface every player provider implements. */
export interface PlayerSession {
  readonly actions: PlayerActions;
  readonly meta: PlayerMeta;
  readonly state: PlayerState;
}

const SessionContext = createContext<PlayerSession | null>(null);
const ViewContext = createContext<StoreApi<PlayerView> | null>(null);
const PromptsContext = createContext<ReadonlyMap<string, ReactNode> | null>(
  null
);

/**
 * Shares one attempt session and creates its view store once. The session is
 * computed during render, so it travels in a plain context; navigation state
 * that only the player writes lives in the store.
 */
export function PlayerProvider({
  children,
  mode,
  session,
}: {
  readonly children: ReactNode;
  /** The mode the server rendered, so hydration never switches it. */
  readonly mode: PlayerMode;
  readonly session: PlayerSession;
}) {
  const [store] = useState(() =>
    createPlayerStore({
      keys: session.state.questions.map((question) => question.key),
      mode,
    })
  );
  return (
    <SessionContext value={session}>
      <ViewContext value={store}>{children}</ViewContext>
    </SessionContext>
  );
}

/** Shares the rendered question bodies, keyed like the questions. */
export function PlayerPrompts({
  children,
  prompts,
}: {
  readonly children: ReactNode;
  readonly prompts: ReadonlyMap<string, ReactNode>;
}) {
  return <PromptsContext value={prompts}>{children}</PromptsContext>;
}

/** Selects one value from the attempt session. */
export function usePlayer<T>(selector: (session: PlayerSession) => T): T {
  const session = use(SessionContext);
  if (!session) {
    throw new Error("usePlayer must be used within a PlayerProvider.");
  }
  return selector(session);
}

/** Selects one value from the view store; it re-renders only on change. */
export function usePlayerView<T>(selector: (view: PlayerView) => T): T {
  const store = use(ViewContext);
  if (!store) {
    throw new Error("usePlayerView must be used within a PlayerProvider.");
  }
  return useStore(store, selector);
}

/** Selects from the rendered question bodies. */
export function usePlayerPrompts<T>(
  selector: (prompts: ReadonlyMap<string, ReactNode>) => T
): T {
  const prompts = use(PromptsContext);
  if (!prompts) {
    throw new Error("usePlayerPrompts must be used within PlayerPrompts.");
  }
  return selector(prompts);
}
