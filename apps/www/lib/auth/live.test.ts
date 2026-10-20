// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ConvexReactClient } from "convex/react";
import { Effect, Fiber, Option } from "effect";
import {
  createLiveSessionStore,
  type LiveAuthClient,
  LiveSessionLoadFailed,
  type LiveSessionModules,
  loadPageModule,
  startLiveSession,
} from "@/lib/auth/live";

const CONVEX_URL = "https://example.convex.cloud";
const SIGNED_IN_COOKIE = "theme=dark; nakafa-signed-in=1";
const VISITOR_COOKIE = "theme=dark";

const reports = vi.hoisted(() => ({ errors: [] as unknown[] }));

/** The page's browser modules, as the default loader of a signed-in page imports them. */
const pageModules = vi.hoisted(() => {
  const session = {
    listener: undefined as ((value: unknown) => void) | undefined,
    unsubscribed: 0,
  };
  return {
    convex: undefined as ConvexReactClient | undefined,
    session,
  };
});

vi.mock("@/lib/auth/client", () => ({
  readAuthClient: () => ({
    $store: {
      atoms: {
        session: {
          subscribe: (next: (value: unknown) => void) => {
            pageModules.session.listener = next;
            return () => {
              pageModules.session.unsubscribed += 1;
            };
          },
        },
      },
    },
  }),
}));

vi.mock("@/lib/convex/client.client", () => ({
  readConvexClient: (convexUrl: string) => {
    pageModules.convex ??= new ConvexReactClient(convexUrl, { logger: false });
    return pageModules.convex;
  },
}));

vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Eff } = await import("effect");
  return {
    reportClientException: (error: unknown) =>
      Eff.sync(() => {
        reports.errors.push(error);
      }),
  };
});

/** A Better Auth session atom that the test drives: it reports values to its listener. */
function sessionAtom() {
  let listener: ((value: unknown) => void) | undefined;
  const unsubscribe = vi.fn(() => {
    listener = undefined;
  });
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

/** Browser modules that load and record each load, so a test can see what a page loaded. */
function loadedModules(session: ReturnType<typeof sessionAtom>) {
  const loads: string[] = [];
  const convex = new ConvexReactClient(CONVEX_URL, { logger: false });
  const authClient: LiveAuthClient = {
    $store: { atoms: { session: session.atom } },
  };
  const modules: LiveSessionModules = {
    auth: Effect.sync(() => {
      loads.push("auth");
      return { readAuthClient: () => authClient };
    }),
    convex: Effect.sync(() => {
      loads.push("convex");
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
  it("names a browser module that fails to load", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(loadPageModule(() => Promise.reject(new Error("offline"))))
    );

    expect(failure).toBeInstanceOf(LiveSessionLoadFailed);
  });

  it("starts signed out with no client and no Convex answer", () => {
    const state = createLiveSessionStore().getState();

    expect(state.isPending).toBe(false);
    expect(state.sessionId).toBeNull();
    expect(state.client).toBeNull();
    expect(Option.isNone(state.confirmation)).toBe(true);
  });

  it("leaves a visitor's page with no client and loads no browser module", () => {
    const session = sessionAtom();
    const { loads, modules } = loadedModules(session);
    const store = createLiveSessionStore();

    Effect.runFork(
      startLiveSession(store, {
        convexUrl: CONVEX_URL,
        cookie: VISITOR_COOKIE,
        modules,
      })
    );

    expect(loads).toStrictEqual([]);
    expect(store.getState().client).toBeNull();
    expect(store.getState().isPending).toBe(false);
  });

  it("creates the page's one client for a signed-in hint and follows Better Auth's session", () => {
    const session = sessionAtom();
    const { convex, loads, modules } = loadedModules(session);
    const store = createLiveSessionStore();

    const fiber = Effect.runFork(
      startLiveSession(store, {
        convexUrl: CONVEX_URL,
        cookie: SIGNED_IN_COOKIE,
        modules,
      })
    );

    expect(loads).toStrictEqual(["auth", "convex"]);
    expect(store.getState().client).toBe(convex);
    expect(store.getState().isPending).toBe(true);

    session.report(signedInSession);

    expect(store.getState().isPending).toBe(false);
    expect(store.getState().sessionId).toBe("session-1");
    expect(store.getState().userId).toBe("user-1");

    Effect.runFork(Fiber.interrupt(fiber));
    expect(session.unsubscribe).toHaveBeenCalledOnce();
  });

  it("loads the page's own browser modules for a signed-in hint", async () => {
    const store = createLiveSessionStore();

    const fiber = Effect.runFork(
      startLiveSession(store, {
        convexUrl: CONVEX_URL,
        cookie: SIGNED_IN_COOKIE,
      })
    );

    await vi.waitFor(() => {
      expect(store.getState().client).not.toBeNull();
    });
    expect(store.getState().client).toBe(pageModules.convex);
    expect(store.getState().isPending).toBe(true);
    Effect.runFork(Fiber.interrupt(fiber));
    expect(pageModules.session.unsubscribed).toBe(1);
  });

  it("starts once, so a second start loads nothing", () => {
    const session = sessionAtom();
    const { loads, modules } = loadedModules(session);
    const store = createLiveSessionStore();
    const start = startLiveSession(store, {
      convexUrl: CONVEX_URL,
      cookie: SIGNED_IN_COOKIE,
      modules,
    });

    Effect.runFork(start);
    Effect.runFork(start);

    expect(loads).toStrictEqual(["auth", "convex"]);
  });

  it("reports a failed module load and keeps the visitor's signed-out page", () => {
    const store = createLiveSessionStore();
    const failure = new LiveSessionLoadFailed({ cause: "offline" });

    Effect.runFork(
      startLiveSession(store, {
        convexUrl: CONVEX_URL,
        cookie: SIGNED_IN_COOKIE,
        modules: {
          auth: Effect.fail(failure),
          convex: Effect.fail(failure),
        },
      })
    );

    expect(reports.errors).toStrictEqual([failure]);
    expect(store.getState().client).toBeNull();
    expect(store.getState().isPending).toBe(false);
  });
});
