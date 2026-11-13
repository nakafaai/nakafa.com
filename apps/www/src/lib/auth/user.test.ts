import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import { SESSION_USER_KEY } from "@/lib/auth/keys";

/** The JSON text of one body. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** An access token of `sub`, which the store reads without verifying. */
const tokenOf = (sub: string) =>
  Arr.join(
    [
      Base64Url.encode(encodeJson({ alg: "ES256" })),
      Base64Url.encode(encodeJson({ exp: 4_102_444_800, sub })),
      "signature",
    ],
    "."
  );

/** A fresh copy of the module, which reads the storage when it loads. */
const loadModule = async () => {
  vi.resetModules();
  return await import("@/lib/auth/user");
};

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("sessionUser", () => {
  it("starts from the account the browser stored for its last session", async () => {
    window.localStorage.setItem(
      SESSION_USER_KEY,
      encodeJson({ sessionId: "session-1", userId: "user-1" })
    );

    const { sessionUser } = await loadModule();

    expect(sessionUser.getState().user).toEqual({
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it("starts empty when the storage holds nothing readable or refuses", async () => {
    window.localStorage.setItem(SESSION_USER_KEY, "not json");
    expect((await loadModule()).sessionUser.getState().user).toBeNull();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect((await loadModule()).sessionUser.getState().user).toBeNull();
  });
});

describe("rememberSessionUser", () => {
  it("keeps the account of the session the token names, for this page and the next", async () => {
    const { rememberSessionUser, sessionUser } = await loadModule();

    rememberSessionUser(tokenOf("session-2"), "user-2");

    expect(sessionUser.getState().user).toEqual({
      sessionId: "session-2",
      userId: "user-2",
    });
    expect(window.localStorage.getItem(SESSION_USER_KEY)).toBe(
      encodeJson({ sessionId: "session-2", userId: "user-2" })
    );
  });

  it("keeps nothing for a token that names no session", async () => {
    const { rememberSessionUser, sessionUser } = await loadModule();

    rememberSessionUser("not-a-token", "user-2");

    expect(sessionUser.getState().user).toBeNull();
    expect(window.localStorage.getItem(SESSION_USER_KEY)).toBeNull();
  });

  it("keeps the account for the page when the storage refuses the write", async () => {
    const { rememberSessionUser, sessionUser } = await loadModule();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    rememberSessionUser(tokenOf("session-3"), "user-3");

    expect(sessionUser.getState().user?.userId).toBe("user-3");
  });
});
