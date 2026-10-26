import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Account } from "@repo/backend/confect/auth/schema";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { reportClientException } from "@/lib/analytics/client";
import {
  loadKnownAccountText,
  readKnownAccount,
  saveKnownAccount,
} from "@/lib/identity/known";

const reportClientExceptionMock = vi.hoisted(() =>
  vi.fn<typeof reportClientException>(() => Effect.void)
);
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: reportClientExceptionMock,
}));

/** A learner's account as the account query answers it, drawn by the photo of its Google account. */
const account = Schema.decodeUnknownSync(Account)({
  appUser: {
    _creationTime: 1,
    _id: "users-1",
    authId: "auth-1",
    credits: 1000,
    creditsResetAt: 0,
    email: "learner@example.com",
    image: "https://example.com/photo.png",
    mascot: "cat.0.243e66.right.open",
    name: "Learner",
    picture: "photo",
    plan: "free",
  },
  authUser: {
    _id: "auth-1",
    email: "learner@example.com",
    name: "Learner Name",
  },
});

/** What every key of account state in the browser starts with, which signing out clears. */
const ACCOUNT_KEY = /^nakafa-/u;

/** A storage the browser refuses to use, as with storage turned off. */
const refusing = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
};

describe("the account row the browser kept", () => {
  beforeEach(() => {
    window.localStorage.clear();
    reportClientExceptionMock.mockClear();
  });

  it.effect("keeps no row before the sidebar showed one", () =>
    Effect.gen(function* () {
      const text = yield* loadKnownAccountText();
      expect(text).toBeNull();
      expect(readKnownAccount(text, "session-1")).toStrictEqual(Option.none());
    })
  );

  it.effect(
    "keeps what the closed row shows, and reads it back for its session only",
    () =>
      Effect.gen(function* () {
        yield* saveKnownAccount("session-1", account);
        const text = yield* loadKnownAccountText();

        expect(
          Option.map(readKnownAccount(text, "session-1"), (row) => ({
            name: row.name,
            photo: row.photo,
            plan: row.plan,
          }))
        ).toStrictEqual(
          Option.some({
            name: "Learner Name",
            photo: "https://example.com/photo.png",
            plan: "free",
          })
        );
        expect(
          Option.map(readKnownAccount(text, "session-1"), (row) => row.mascot)
        ).toStrictEqual(Option.some(account.appUser.mascot));
        expect(readKnownAccount(text, "session-2")).toStrictEqual(
          Option.none()
        );
        expect(readKnownAccount(text, null)).toStrictEqual(Option.none());
        expect(text).not.toContain("learner@example.com");
        expect(window.localStorage.key(0)).toMatch(ACCOUNT_KEY);
      })
  );

  it.effect("keeps no photo for an account drawn by its animal", () =>
    Effect.gen(function* () {
      yield* saveKnownAccount("session-1", {
        ...account,
        appUser: { ...account.appUser, picture: "animal" },
      });
      const row = readKnownAccount(yield* loadKnownAccountText(), "session-1");

      expect(Option.map(row, (known) => known.photo)).toStrictEqual(
        Option.some(undefined)
      );
    })
  );

  it("reads a row in a shape this page no longer reads as none", () => {
    expect(readKnownAccount("{", "session-1")).toStrictEqual(Option.none());
    expect(
      readKnownAccount(
        '{"name":"Learner","sessionId":"session-1"}',
        "session-1"
      )
    ).toStrictEqual(Option.none());
  });

  it.effect("keeps nothing and reports where storage is refused", () =>
    Effect.gen(function* () {
      expect(yield* loadKnownAccountText(refusing)).toBeNull();
      yield* saveKnownAccount("session-1", account, refusing);

      expect(
        Arr.map(
          reportClientExceptionMock.mock.calls,
          ([, properties]) => properties
        )
      ).toStrictEqual([
        { operation: "load", source: "identity.knownAccount" },
        { operation: "save", source: "identity.knownAccount" },
      ]);
    })
  );
});
