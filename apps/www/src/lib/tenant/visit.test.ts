// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Layer, Option, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import { FetchHttpClient } from "effect/http";
import { SchoolReadFailed, SchoolReads } from "@/lib/tenant/read";
import { readBrowserVisit, reusesVisitFrame } from "@/lib/tenant/visit";

/** One fetch double for the whole file: the browser's request to the token route. */
const fetcher = vi.fn<typeof fetch>();

/** The school decision, which `read.test.ts` proves; these tests read only the token it is asked with. */
const frame = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/tenant/read", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant/read")>()),
  readSchoolFrame: frame.read,
}));

const SLUG = Schema.decodeSync(TenantSlug)("harapan");

/** The reads of the mocked decision, which never run. */
const UNUSED_READS = Layer.succeed(
  SchoolReads,
  SchoolReads.of({
    account: () => Effect.die("account not expected"),
    profile: () => Effect.die("profile not expected"),
    viewer: () => Effect.die("viewer not expected"),
  })
);

/** The legal links of a visitor's entry page, as the static answer of the shell holds them. */
const LINKS = {
  privacy: "https://nakafa.com/en/privacy",
  terms: "https://nakafa.com/en/terms",
};

/** The read of the legal links, which counts how often the decision asks for it. */
const legal = vi.fn(() => LINKS);

/** The JSON text of a token's payload. */
const jsonOf = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** A Convex token of the session `session-ayu`, whose claims the decision reads and does not verify. */
const AYU_TOKEN = `header.${Base64Url.encode(
  jsonOf({
    exp: 1_800_000_000,
    name: "Ayu",
    sessionId: "session-ayu",
    sub: "user-ayu",
  })
)}.signature`;

/**
 * Decides the school in the browser of these tests, whose token route answers with the fetch double, with the
 * sign-in hint saying signed in unless the test says otherwise.
 */
function decide(locale: "en" | "id", signedIn = true) {
  return readBrowserVisit({
    legal: Effect.sync(legal),
    locale,
    signedIn,
    slug: SLUG,
  }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher),
    Effect.provide(UNUSED_READS)
  );
}

describe("reusesVisitFrame", () => {
  it("reads the frame when a visit enters the school", () => {
    expect(reusesVisitFrame({ cause: "enter", invalid: false })).toBe(false);
  });

  it("reuses the frame of a child navigation within the visit", () => {
    expect(reusesVisitFrame({ cause: "stay", invalid: false })).toBe(true);
  });

  it("reads the frame again after a refresh invalidates the school", () => {
    expect(reusesVisitFrame({ cause: "stay", invalid: true })).toBe(false);
  });

  it("reuses the frame that a preload of the school read", () => {
    expect(reusesVisitFrame({ cause: "preload", invalid: false })).toBe(true);
  });
});

describe("readBrowserSchoolFrame", () => {
  beforeEach(() => {
    fetcher.mockReset();
    legal.mockClear();
    frame.read.mockReset().mockReturnValue(Effect.succeed({ _tag: "Refused" }));
    vi.stubGlobal("window", {
      location: { origin: "https://harapan.nakafa.com" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect(
    "decides the school with the token from the school host's own token route, and reads no legal links for it",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(Response.json({ token: "token-ayu" }));

        expect(yield* decide("en")).toEqual({
          legal: null,
          school: { _tag: "Refused" },
          sessionId: null,
        });
        expect(legal).not.toHaveBeenCalled();

        const [address] = fetcher.mock.calls[0] ?? [];
        expect(String(address)).toBe(
          "https://harapan.nakafa.com/api/auth/convex/token"
        );
        expect(frame.read).toHaveBeenCalledWith({
          locale: "en",
          slug: SLUG,
          token: Option.some("token-ayu"),
        });
      })
  );

  it.effect(
    "decides a visitor's school when the token route finds no session, with the legal links read beside it",
    () =>
      Effect.gen(function* () {
        const visitor = { _tag: "Visitor" };
        frame.read.mockReturnValueOnce(Effect.succeed(visitor));
        fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

        expect(yield* decide("id")).toEqual({
          legal: LINKS,
          school: visitor,
          sessionId: null,
        });

        expect(frame.read).toHaveBeenCalledWith({
          locale: "id",
          slug: SLUG,
          token: Option.none(),
        });
        expect(legal).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "keeps no legal links for a school that refuses a visitor with no session",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

        expect(yield* decide("en")).toEqual({
          legal: null,
          school: { _tag: "Refused" },
          sessionId: null,
        });
      })
  );

  it.effect(
    "names the session that the token belongs to, so a kept frame is kept for it",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(Response.json({ token: AYU_TOKEN }));

        expect((yield* decide("en")).sessionId).toBe("session-ayu");
      })
  );

  it.effect(
    "starts a visitor's reads beside the token's when the sign-in hint says signed out",
    () =>
      Effect.gen(function* () {
        const visitor = { _tag: "Visitor" };
        frame.read.mockReturnValue(Effect.succeed(visitor));
        fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

        expect(yield* decide("en", false)).toEqual({
          legal: LINKS,
          school: visitor,
          sessionId: null,
        });
        expect(frame.read).toHaveBeenCalledOnce();
        expect(legal).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "decides as signed in when a token answers despite the hint, whatever the early visitor's read answered",
    () =>
      Effect.gen(function* () {
        const member = { _tag: "Member" };
        frame.read.mockImplementation(
          (input: { token: Option.Option<string> }) =>
            Option.isSome(input.token)
              ? Effect.succeed(member)
              : Effect.fail(new SchoolReadFailed({ cause: "profile" }))
        );
        fetcher.mockResolvedValueOnce(Response.json({ token: AYU_TOKEN }));

        expect(yield* decide("en", false)).toEqual({
          legal: null,
          school: member,
          sessionId: "session-ayu",
        });
      })
  );

  it.effect(
    "fails a signed-out visit whose visitor read fails, so an outage never reads as a school",
    () =>
      Effect.gen(function* () {
        frame.read.mockReturnValue(
          Effect.fail(new SchoolReadFailed({ cause: "profile" }))
        );
        fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

        expect(yield* decide("en", false).pipe(Effect.flip)).toBeInstanceOf(
          SchoolReadFailed
        );
      })
  );

  it.effect(
    "fails the decision when the token route refuses, so an outage never reads as a visitor",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));

        const failure = yield* decide("en").pipe(Effect.flip);

        expect(failure).toBeInstanceOf(SchoolReadFailed);
        expect(frame.read).not.toHaveBeenCalled();
      })
  );
});
