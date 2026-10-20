// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ConvexReactClient } from "convex/react";
import { Effect, Option } from "effect";
import {
  createLiveSessionStore,
  LiveSessionLoadFailed,
  type LiveSessionModules,
  loadPageModule,
  startLiveSession,
} from "@/lib/auth/live";

const CONVEX_URL = "https://example.convex.cloud";
const SIGNED_IN_COOKIE = "theme=dark; nakafa-signed-in=1";
const VISITOR_COOKIE = "theme=dark";

/** The page's browser modules that the default loader of a signed-in page imports. */
const pageModules = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  return {
    listen: vi.fn(() => unsubscribe),
    readConvexClient: vi.fn(),
    unsubscribe,
  };
});

vi.mock("@/lib/auth/client", () => ({
  readAuthClient: () => ({
    $store: {
      atoms: {
        session: { subscribe: pageModules.listen },
      },
    },
  }),
}));

vi.mock("@/lib/convex/client.client", async () => {
  const { ConvexReactClient: Client } = await import("convex/react");
  const client = new Client("https://example.convex.cloud", { logger: false });
  pageModules.readConvexClient.mockReturnValue(client);
  return { readConvexClient: pageModules.readConvexClient };
});

/** A Better Auth session atom that the test drives: it reports values to its listener. */
function sessionAtom() {
  let listener: ((value: unknown) => void) | undefined;
  const unsubscribe = vi.fn();
  return {
    atom: {
      subscribe: (next: (value: unknown) => void) => {
        listener = next;
        return unsubscribe;
      },
    },
    report: (value: unknown) => listener?.(value),
    unsubscribe,
  };
}

/** Browser modules that record each load, so a test can see which modules a page loaded. */
function recordingModules(atom: ReturnType<typeof sessionAtom>["atom"]) {
  const loads = vi.fn();
  const convex = new ConvexReactClient(CONVEX_URL, { logger: false });
  const modules: LiveSessionModules = {
    auth: Effect.sync(() => {
      loads("auth");
      return { readSessionAtom: () => atom };
    }),
    convex: Effect.sync(() => {
      loads("convex");
      return { readConvexClient: () => convex };
    }),
  };
  return { convex, loads, modules };
}

const signedInSession = {
  data: { session: { id: "session-1" }, user: { id: "user-1" } },
  error: null,
  isPending: false,
};

describe("live session store", () => {
  it("starts signed out with no client and no Convex answer", () => {
    const state = createLiveSessionStore().getState();

    expect(state.isPending).toBe(false);
    expect(state.sessionId).toBeNull();
    expect(state.client).toBeNull();
    expect(Option.isNone(state.confirmation)).toBe(true);
  });

  it.effect("names a browser module that fails to load", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        loadPageModule(() => Promise.reject(new Error("offline")))
      );

      expect(failure).toBeInstanceOf(LiveSessionLoadFailed);
    })
  );

  it.effect(
    "leaves a visitor's page with no client and loads no browser module",
    () =>
      Effect.gen(function* () {
        const session = sessionAtom();
        const { loads, modules } = recordingModules(session.atom);
        const store = createLiveSessionStore();

        yield* startLiveSession(store, {
          convexUrl: CONVEX_URL,
          cookie: VISITOR_COOKIE,
          modules,
        });

        expect(loads).not.toHaveBeenCalled();
        expect(store.getState().client).toBeNull();
        expect(store.getState().isPending).toBe(false);
      })
  );

  it.effect(
    "creates the page's one client and follows Better Auth's session",
    () =>
      Effect.gen(function* () {
        const session = sessionAtom();
        const { convex, loads, modules } = recordingModules(session.atom);
        const store = createLiveSessionStore();

        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* Effect.forkScoped(
              startLiveSession(store, {
                convexUrl: CONVEX_URL,
                cookie: SIGNED_IN_COOKIE,
                modules,
              })
            );
            yield* Effect.yieldNow;

            expect(loads).toHaveBeenCalledWith("auth");
            expect(loads).toHaveBeenCalledWith("convex");
            expect(store.getState().client).toBe(convex);
            expect(store.getState().isPending).toBe(true);

            session.report(signedInSession);

            expect(store.getState().isPending).toBe(false);
            expect(store.getState().sessionId).toBe("session-1");
            expect(store.getState().userId).toBe("user-1");
          })
        );

        expect(session.unsubscribe).toHaveBeenCalledOnce();
      })
  );

  it.effect("loads the page's own browser modules for a signed-in hint", () =>
    Effect.gen(function* () {
      const store = createLiveSessionStore();

      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Effect.forkScoped(
            startLiveSession(store, {
              convexUrl: CONVEX_URL,
              cookie: SIGNED_IN_COOKIE,
            })
          );
          yield* Effect.promise(() =>
            vi.waitFor(() => {
              expect(store.getState().client).not.toBeNull();
            })
          );

          expect(pageModules.readConvexClient).toHaveBeenCalledWith(CONVEX_URL);
          expect(store.getState().isPending).toBe(true);
        })
      );

      expect(pageModules.unsubscribe).toHaveBeenCalledOnce();
    })
  );

  it.effect("starts once, so a second start loads nothing", () =>
    Effect.gen(function* () {
      const session = sessionAtom();
      const { loads, modules } = recordingModules(session.atom);
      const store = createLiveSessionStore();
      const start = startLiveSession(store, {
        convexUrl: CONVEX_URL,
        cookie: SIGNED_IN_COOKIE,
        modules,
      });

      yield* Effect.forkScoped(start);
      yield* Effect.yieldNow;
      yield* Effect.forkScoped(start);
      yield* Effect.yieldNow;

      expect(loads).toHaveBeenCalledTimes(2);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "keeps the visitor's signed-out page when a module fails to load",
    () =>
      Effect.gen(function* () {
        const store = createLiveSessionStore();
        const failure = new LiveSessionLoadFailed({ cause: "offline" });

        yield* startLiveSession(store, {
          convexUrl: CONVEX_URL,
          cookie: SIGNED_IN_COOKIE,
          modules: {
            auth: Effect.fail(failure),
            convex: Effect.fail(failure),
          },
        });

        expect(store.getState().client).toBeNull();
        expect(store.getState().isPending).toBe(false);
      })
  );
});
