import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { Effect } from "effect";
import {
  GoogleSignInFailed,
  SchoolSignInFailed,
  signInSchoolLogin,
  startGoogleSignIn,
} from "@/lib/auth/signin";

/** Convex Auth's client as the sign-ins drive it: the oauth actions it publishes and the session it adopts. */
const auth = vi.hoisted(() => ({
  actions: new Map<string, unknown>(),
  setSession: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/auth/client", () => ({
  readAuthClient: () =>
    Effect.succeed({
      ambientSignInValues: () => auth.actions,
      setSession: auth.setSession,
    }),
  SIGN_IN_ROUTE: "/api/auth/signin",
}));

/** The sign-in route's client. */
const proxy = vi.hoisted(() => ({ address: "", mutation: vi.fn() }));

vi.mock("convex/browser", () => ({
  /** The sign-in route's client, whose calls reach the double above. */
  ConvexHttpClient: class {
    readonly doubles = proxy;
    constructor(address: string) {
      proxy.address = address;
    }
    mutation(...args: unknown[]) {
      return this.doubles.mutation(...args);
    }
  },
}));

const remembered = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/user", () => ({ rememberSessionUser: remembered }));

/** The page's Convex client, which the mocked auth client never reads. */
const convex = {
  mutation: vi.fn<ConvexReactClient["mutation"]>(),
  url: "https://example.convex.cloud",
};

const LOGIN = { loginName: "ayu", password: "secret-1", slug: "harapan" };

beforeEach(() => {
  auth.actions.clear();
  auth.setSession.mockClear();
  proxy.mutation.mockReset();
  remembered.mockReset();
});

describe("startGoogleSignIn", () => {
  it.effect("starts Google's sign-in with the main site's return address", () =>
    Effect.gen(function* () {
      const signIn = vi.fn(() => Promise.resolve({ status: "redirect" }));
      auth.actions.set("actions", { signIn });

      yield* startGoogleSignIn(convex, "https://nakafa.com/en/home");

      const [provider, options] = signIn.mock.calls[0] ?? [];
      expect(options).toEqual({ redirectTo: "https://nakafa.com/en/home" });
      expect(provider).toMatchObject({ providerName: "google" });
    })
  );

  it.effect.each([
    { case: "the oauth sign-in is not registered", actions: undefined },
    {
      case: "Google did not answer with a redirect",
      actions: { signIn: () => Promise.resolve({ status: "complete" }) },
    },
    {
      case: "the start could not reach the deployment",
      actions: { signIn: () => Promise.reject(new Error("offline")) },
    },
  ])("fails when $case", ({ actions }) =>
    Effect.gen(function* () {
      auth.actions.set("actions", actions);

      const failure = yield* Effect.flip(
        startGoogleSignIn(convex, "https://nakafa.com/en/home")
      );

      expect(failure).toBeInstanceOf(GoogleSignInFailed);
    })
  );
});

describe("signInSchoolLogin", () => {
  it.effect("adopts the session the sign-in route answers", () =>
    Effect.gen(function* () {
      const tokens = { accessToken: "access", userId: "user-1" };
      proxy.mutation.mockResolvedValueOnce({ status: "complete", tokens });

      expect(yield* signInSchoolLogin(convex, LOGIN)).toBe(true);

      expect(proxy.address).toBe("/api/auth/signin?path=");
      const [reference, args] = proxy.mutation.mock.calls[0] ?? [];
      expect(getFunctionName(reference)).toBe("auth/school:signIn");
      expect(args).toEqual(LOGIN);
      expect(remembered).toHaveBeenCalledWith("access", "user-1");
      expect(auth.setSession).toHaveBeenCalledWith(tokens);
    })
  );

  it.effect("answers false for a refusal, whatever its reason", () =>
    Effect.gen(function* () {
      proxy.mutation.mockResolvedValueOnce({ status: "error" });

      expect(yield* signInSchoolLogin(convex, LOGIN)).toBe(false);
      expect(auth.setSession).not.toHaveBeenCalled();
    })
  );

  it.effect.each([
    {
      case: "cannot reach the route",
      answer: () => Promise.reject(new Error("offline")),
    },
    {
      case: "answers what no sign-in reads as",
      answer: () => Promise.resolve({ other: true }),
    },
  ])("fails when the sign-in $case", ({ answer }) =>
    Effect.gen(function* () {
      proxy.mutation.mockImplementationOnce(answer);

      const failure = yield* Effect.flip(signInSchoolLogin(convex, LOGIN));

      expect(failure).toBeInstanceOf(SchoolSignInFailed);
    })
  );
});
