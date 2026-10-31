// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Layer, Option, Schema } from "effect";
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

/** Decides the school in the browser of these tests, whose token route answers with the fetch double. */
function decide(locale: "en" | "id") {
  return readBrowserVisit(SLUG, locale, Effect.sync(legal)).pipe(
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

        expect(yield* decide("id")).toEqual({ legal: LINKS, school: visitor });

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
        });
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
