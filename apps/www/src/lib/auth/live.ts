import type { ConvexReactClient } from "convex/react";
import { Effect, Option, Result, Schema } from "effect";
import { createStore, type StoreApi } from "zustand";
import { reportClientException } from "@/lib/analytics/client";
import type { ConvexAuthConfirmation } from "@/lib/auth/convex";
import type { SessionFeed } from "@/lib/auth/feed";
import { hasSignedInHint } from "@/lib/auth/hint";
import { followAuthSession, previewAuthSession } from "@/lib/auth/session";

/**
 * The state the server renders for a page's live session: signed out, with no
 * client and no Convex answer. Its type is derived from this constructor, because
 * the Convex client is a runtime value that no Schema describes.
 */
function initialLiveSessionState(client: Option.Option<ConvexReactClient>) {
  return {
    ...previewAuthSession,
    client,
    confirmation: Option.none<ConvexAuthConfirmation>(),
    isPointerDown: false,
  };
}

/**
 * The live session of one page: Convex Auth's session as its readers see it,
 * Convex's answer for that session, the page's one Convex client, and whether a
 * pointer is down, which holds an island's swap to that client. The fields are
 * flat, so the store is also the session store and the Convex authentication store
 * that the shared readers select from, and one store serves every reader.
 */
export type LiveSessionState = ReturnType<typeof initialLiveSessionState>;

export type LiveSessionStore = StoreApi<LiveSessionState>;

/**
 * Creates one page's live session in the state the server renders: signed out,
 * with no client. The browser moves it on only after hydration, and only for a
 * page whose signed-in hint says a session may exist.
 */
export function createLiveSessionStore(): LiveSessionStore {
  return createStore<LiveSessionState>(() =>
    initialLiveSessionState(Option.none())
  );
}

/** A browser module of a signed-in page failed to load, so the page keeps its visitor state. */
export class LiveSessionLoadFailed extends Schema.TaggedError<
  LiveSessionLoadFailed,
  { readonly brand: unique symbol }
>()("LiveSessionLoadFailed", { cause: Schema.Unknown }) {}

/** The browser modules a signed-in page loads, as the page loads them. */
export interface LiveSessionModules {
  /** Convex Auth's session, which a signed-in page needs and a visitor never does. */
  readonly auth: Effect.Effect<
    {
      readonly followClientSession: (convex: ConvexReactClient) => SessionFeed;
    },
    LiveSessionLoadFailed
  >;
  /** Convex's client module, whose constructor opens no socket. */
  readonly convex: Effect.Effect<
    {
      readonly readConvexClient: (convexUrl: string) => ConvexReactClient;
    },
    LiveSessionLoadFailed
  >;
}

/** Loads one browser module at the framework Promise boundary, and names a load that fails. */
export function loadPageModule<A>(load: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) => new LiveSessionLoadFailed({ cause }),
    try: load,
  });
}

/** The page's browser modules, loaded with dynamic imports so a visitor's page never loads them. */
const liveSessionModules: LiveSessionModules = {
  auth: loadPageModule(() => import("@/lib/auth/feed")),
  convex: loadPageModule(() => import("@/lib/convex/client")),
};

/**
 * Follows Convex Auth's session into the store until the scope closes, so the
 * readers see the session as the client settles it.
 */
const followSession = Effect.fn("www.auth.followSession")(function* (
  store: LiveSessionStore,
  session: SessionFeed
) {
  yield* Effect.acquireRelease(
    Effect.sync(() =>
      session.subscribe((value) => {
        store.setState((previous) => followAuthSession(previous, value));
      })
    ),
    (unsubscribe) => Effect.sync(unsubscribe)
  );
  return yield* Effect.never;
});

/**
 * Starts the page's live session after hydration. A visitor's page, which the
 * signed-in hint does not mark, loads nothing and keeps the signed-out session.
 * A marked page loads the Convex Auth and Convex clients, follows Convex Auth's
 * session from pending, and creates the page's one Convex client. Constructing
 * that client opens no socket: the first subscription or `setAuth` opens one.
 * The fiber runs until it is interrupted, which closes the subscription. A
 * failed load reports the failure and leaves the page as a visitor's whose
 * session the page could not read (`hasError`), so no reader takes it for a
 * signed-out session and a press held for it settles.
 */
export const startLiveSession = Effect.fn("www.auth.startLiveSession")(
  function* (
    store: LiveSessionStore,
    {
      convexUrl,
      cookie,
      isPointerDown,
      modules = liveSessionModules,
    }: {
      readonly convexUrl: string;
      readonly cookie: string;
      /** Whether a press from before the page's listeners is still held. */
      readonly isPointerDown: boolean;
      readonly modules?: LiveSessionModules;
    }
  ) {
    if (!hasSignedInHint(cookie) || Option.isSome(store.getState().client)) {
      return;
    }
    store.setState({
      hasError: false,
      isPending: true,
      isPointerDown,
      sessionId: null,
      userId: null,
    });
    const loaded = yield* Effect.all({
      auth: modules.auth,
      convex: modules.convex,
    }).pipe(
      Effect.tapError((error) =>
        reportClientException(error, { source: "live-session-load" })
      ),
      Effect.result
    );
    if (Result.isFailure(loaded)) {
      store.setState({
        ...previewAuthSession,
        client: Option.none(),
        hasError: true,
      });
      return;
    }
    const convex = loaded.success.convex.readConvexClient(convexUrl);
    store.setState({ client: Option.some(convex) });
    return yield* Effect.scoped(
      followSession(store, loaded.success.auth.followClientSession(convex))
    );
  }
);
