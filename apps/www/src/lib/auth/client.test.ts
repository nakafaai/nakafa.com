import type { AuthClientConfig } from "@convex-dev/auth/browser";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

/** One AuthClient the module made: the configuration it was given, its doubles, and the token it holds. */
interface Made {
  readonly config: AuthClientConfig;
  readonly init: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  token: string | null;
}

/** Each AuthClient the module made, in order. */
const made = vi.hoisted(() => ({ clients: [] as Made[] }));

vi.mock("@convex-dev/auth/browser", () => ({
  /** Convex Auth's client, as far as the module drives it. */
  AuthClient: class {
    readonly made: Made;
    constructor(config: AuthClientConfig) {
      this.made = {
        config,
        init: vi.fn(() => Promise.resolve()),
        signOut: vi.fn(() => Promise.resolve()),
        token: null,
      };
      made.clients.push(this.made);
    }
    init() {
      return this.made.init();
    }
    signOut() {
      return this.made.signOut();
    }
    getAccessToken() {
      return this.made.token;
    }
  },
  defaultStorage: () => "storage",
}));

vi.mock("@convex-dev/auth/methods/oauth/react", () => ({
  oauth: () => "oauth",
}));

/** The sign-in route's client, which the module points at the sign-in route. */
const proxy = vi.hoisted(() => ({
  action: vi.fn(),
  address: "",
  clearAuth: vi.fn(),
  mutation: vi.fn(),
  setAuth: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  /** The sign-in route's client, whose calls reach the doubles above. */
  ConvexHttpClient: class {
    readonly doubles = proxy;
    constructor(address: string) {
      proxy.address = address;
    }
    action(...args: unknown[]) {
      return this.doubles.action(...args);
    }
    clearAuth() {
      this.doubles.clearAuth();
    }
    mutation(...args: unknown[]) {
      return this.doubles.mutation(...args);
    }
    setAuth(token: string) {
      this.doubles.setAuth(token);
    }
  },
}));

/** The browser's requests, one double for the file (AGENTS.md). */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

/** The account store, whose writes the tests read. */
const remembered = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/user", () => ({ rememberSessionUser: remembered }));

/** The page's Convex client, as far as the auth client uses it. */
const convex = {
  mutation: vi.fn(),
  url: "https://example.convex.cloud",
};

/** A fresh copy of the module, whose page client is not made yet. */
const loadModule = async () => {
  vi.resetModules();
  return await import("@/lib/auth/client");
};

/** The only client the module made. */
const configOf = () => Effect.fromNullishOr(made.clients[0]).pipe(Effect.orDie);

const RANDOM = makeFunctionReference<"mutation">("auth/school:signIn");
const ACTION = makeFunctionReference<"action">("auth/school:signIn");

beforeEach(() => {
  made.clients.length = 0;
  fetcher.mockReset();
  remembered.mockReset();
  for (const double of [
    proxy.action,
    proxy.clearAuth,
    proxy.mutation,
    proxy.setAuth,
  ]) {
    double.mockReset();
  }
});

describe("readAuthClient", () => {
  it.effect(
    "makes no client on import, and one started client for every reader",
    () =>
      Effect.gen(function* () {
        const { readAuthClient } = yield* Effect.promise(loadModule);
        expect(made.clients).toHaveLength(0);

        const [first, second] = yield* Effect.all(
          [readAuthClient(convex), readAuthClient(convex)],
          { concurrency: 2 }
        );

        expect(first).toBe(second);
        expect(made.clients).toHaveLength(1);
        expect((yield* configOf()).init).toHaveBeenCalledOnce();
        expect((yield* configOf()).config).toMatchObject({
          mode: "ssr",
          storage: "storage",
          storageNamespace: convex.url,
        });
        expect(proxy.address).toBe("/api/auth/signin?path=");
      })
  );
});

describe("the client's sign-in calls", () => {
  it.effect(
    "sends each call through the sign-in route with the session's token, and keeps the account a sign-in names",
    () =>
      Effect.gen(function* () {
        const { readAuthClient } = yield* Effect.promise(loadModule);
        yield* readAuthClient(convex);
        const { ambientSignIns } = (yield* configOf()).config;
        const signInApi = ambientSignIns?.signInApi;
        const complete = {
          status: "complete",
          tokens: { accessToken: "access", userId: "user-1" },
        };
        proxy.mutation.mockResolvedValueOnce(complete);
        proxy.mutation.mockResolvedValueOnce({ status: "error" });
        proxy.action.mockResolvedValueOnce("acted");

        expect(
          yield* Effect.promise(
            async () => await signInApi?.mutation(RANDOM, {})
          )
        ).toEqual(complete);
        expect(proxy.clearAuth).toHaveBeenCalledOnce();
        expect(remembered).toHaveBeenCalledWith("access", "user-1");

        (yield* configOf()).token = "held";
        yield* Effect.promise(
          async () => await signInApi?.mutation(RANDOM, {})
        );
        expect(proxy.setAuth).toHaveBeenCalledWith("held");
        expect(remembered).toHaveBeenCalledOnce();

        expect(
          yield* Effect.promise(async () => await signInApi?.action(ACTION, {}))
        ).toBe("acted");
      })
  );

  it.effect(
    "starts Google on the page's Convex client and rewrites the address in place",
    () =>
      Effect.gen(function* () {
        const { readAuthClient } = yield* Effect.promise(loadModule);
        yield* readAuthClient(convex);
        const ambient = (yield* configOf()).config.ambientSignIns;
        convex.mutation.mockResolvedValueOnce("started");

        expect(
          yield* Effect.promise(
            async () => await ambient?.convex.mutation(RANDOM, {})
          )
        ).toBe("started");
        ambient?.replaceUrl?.("/en/home?done=1");
        expect(window.location.pathname).toBe("/en/home");
        expect(ambient?.signIns).toEqual(["oauth"]);
      })
  );
});

describe("the client's session routes", () => {
  it.effect(
    "refreshes through the refresh route and keeps the account it names",
    () =>
      Effect.gen(function* () {
        const { readAuthClient } = yield* Effect.promise(loadModule);
        yield* readAuthClient(convex);
        const { authApi } = (yield* configOf()).config;
        fetcher
          .mockResolvedValueOnce(
            Response.json({
              tokens: { accessToken: "access", userId: "user-1" },
            })
          )
          .mockResolvedValueOnce(new Response(null, { status: 401 }));

        expect(
          yield* Effect.promise(async () => await authApi.refreshSession(""))
        ).toEqual({ accessToken: "access", userId: "user-1" });
        expect(remembered).toHaveBeenCalledWith("access", "user-1");
        expect(
          yield* Effect.promise(async () => await authApi.refreshSession(""))
        ).toBeNull();
        expect(remembered).toHaveBeenCalledOnce();
        const [address, init] = fetcher.mock.calls[0] ?? [];
        expect(String(address)).toBe(
          `${window.location.origin}/api/auth/refresh`
        );
        expect(init?.method).toBe("POST");
      })
  );

  it.effect(
    "signs out through the sign-out route before the client forgets its token",
    () =>
      Effect.gen(function* () {
        const { signOutSession } = yield* Effect.promise(loadModule);
        fetcher.mockResolvedValue(Response.json({ tokens: null }));

        yield* signOutSession(convex);

        const [address] = fetcher.mock.calls[0] ?? [];
        expect(String(address)).toBe(
          `${window.location.origin}/api/auth/signout`
        );
        const client = yield* configOf();
        expect(client.signOut).toHaveBeenCalledOnce();
        yield* Effect.promise(() => client.config.authApi.signOut(""));
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect("keeps the session when the sign-out route does not answer", () =>
    Effect.gen(function* () {
      const { signOutSession, SignOutFailed } =
        yield* Effect.promise(loadModule);
      fetcher.mockResolvedValueOnce(new Response(null, { status: 502 }));

      const failure = yield* Effect.flip(signOutSession(convex));

      expect(failure).toBeInstanceOf(SignOutFailed);
      expect((yield* configOf()).signOut).not.toHaveBeenCalled();
    })
  );
});
