import { beforeEach, describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { MascotCode } from "@repo/mascot/code";
import { Array as Arr, Effect, Schema } from "effect";
import type { reportClientException } from "@/lib/analytics/client";
import {
  loadKnownSchoolsText,
  readKnownSchools,
  saveKnownSchools,
} from "@/lib/identity/schools";

const reportClientExceptionMock = vi.hoisted(() =>
  vi.fn<typeof reportClientException>(() => Effect.void)
);
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: reportClientExceptionMock,
}));

/** A school with a logo and one drawn by its animal, as the live list answers them. */
const schools = [
  {
    kind: "school",
    logo: "https://example.com/logo.png",
    mascot: Schema.decodeSync(MascotCode)("cat.0.243e66.right.open"),
    name: "SMA Harapan",
    slug: Schema.decodeSync(TenantSlug)("harapan"),
    status: "active",
  },
  {
    kind: "school",
    mascot: Schema.decodeSync(MascotCode)("cat.0.243e66.right.open"),
    name: "SMP Bangsa",
    slug: Schema.decodeSync(TenantSlug)("bangsa"),
    status: "active",
  },
];

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

describe("the schools the browser kept", () => {
  beforeEach(() => {
    window.localStorage.clear();
    reportClientExceptionMock.mockClear();
  });

  it.effect("keeps no school before the menu showed one", () =>
    Effect.gen(function* () {
      const text = yield* loadKnownSchoolsText();
      expect(text).toBeNull();
      expect(readKnownSchools(text, "session-1")).toStrictEqual([]);
    })
  );

  it.effect(
    "keeps what each row shows, and reads it back for its session only",
    () =>
      Effect.gen(function* () {
        yield* saveKnownSchools("session-1", schools);
        const text = yield* loadKnownSchoolsText();

        expect(
          Arr.map(readKnownSchools(text, "session-1"), (school) => school.name)
        ).toStrictEqual(["SMA Harapan", "SMP Bangsa"]);
        expect(readKnownSchools(text, "session-1")[0]?.logo).toBe(
          "https://example.com/logo.png"
        );
        expect(readKnownSchools(text, "session-2")).toStrictEqual([]);
        expect(readKnownSchools(text, null)).toStrictEqual([]);
        expect(text).not.toContain("status");
        expect(window.localStorage.key(0)).toMatch(ACCOUNT_KEY);
      })
  );

  it("reads a list in a shape this page no longer reads as none", () => {
    expect(readKnownSchools("{", "session-1")).toStrictEqual([]);
    expect(
      readKnownSchools(
        '{"schools":[{"name":"Harapan"}],"sessionId":"session-1"}',
        "session-1"
      )
    ).toStrictEqual([]);
  });

  it.effect("keeps nothing and reports where storage is refused", () =>
    Effect.gen(function* () {
      expect(yield* loadKnownSchoolsText(refusing)).toBeNull();
      yield* saveKnownSchools("session-1", schools, refusing);

      expect(
        Arr.map(
          reportClientExceptionMock.mock.calls,
          ([, properties]) => properties
        )
      ).toStrictEqual([
        { operation: "load", source: "identity.knownSchools" },
        { operation: "save", source: "identity.knownSchools" },
      ]);
    })
  );
});
