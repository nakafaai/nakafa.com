// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { SchoolReadFailed, SchoolReads } from "@/lib/tenant/read";
import { readBrowserSchoolFrame, reusesVisitFrame } from "@/lib/tenant/visit";

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

/** Decides the school in the browser of these tests, whose token route answers with the fetch double. */
function decide(locale: "en" | "id") {
  return readBrowserSchoolFrame(SLUG, locale).pipe(
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
    frame.read.mockReset().mockReturnValue(Effect.succeed({ _tag: "Refused" }));
    vi.stubGlobal("window", {
      location: { origin: "https://harapan.nakafa.com" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect(
    "decides the school with the token from the school host's own token route",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(Response.json({ token: "token-ayu" }));

        yield* decide("en");

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
    "decides a visitor's school when the token route finds no session",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

        yield* decide("id");

        expect(frame.read).toHaveBeenCalledWith({
          locale: "id",
          slug: SLUG,
          token: Option.none(),
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
