// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Exit, Fiber, Layer, Option, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { KEPT_SCHOOL_KEY } from "@/lib/auth/keys";
import { SchoolReadFailed, SchoolReads } from "@/lib/tenant/read";
import {
  confirmFrame,
  frameOfNavigation,
  readBrowserVisit,
  retryVisitRead,
  type SchoolVisit,
  takeLiveRead,
} from "@/lib/tenant/visit";

/** One fetch double for the whole file: the browser's request to the token route. */
const fetcher = vi.fn<typeof fetch>();

/** The school decision, which `read.test.ts` proves; these tests read only the token it is asked with. */
const frame = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/tenant/read", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant/read")>()),
  readSchoolFrame: frame.read,
}));

/** The static answer of the shell, which names the legal pages of a visitor's entry page. */
const staticData = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/static/data", () => ({ readStaticData: staticData.read }));
vi.mock("@/lib/marketing/shell.functions", () => ({
  readMarketingShellFn: vi.fn(),
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
  dataProcessing: "https://nakafa.com/en/data-processing-agreement",
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

describe("retryVisitRead", () => {
  /** A read that fails its first `failures` tries, and counts them. */
  const failing = (failures: number) => {
    let tries = 0;
    const read = Effect.suspend(() => {
      tries += 1;
      return tries > failures
        ? Effect.succeed("frame")
        : Effect.fail(new SchoolReadFailed({ cause: "network" }));
    });
    return { read, tried: () => tries };
  };

  it.effect("answers from the try after a lost request", () =>
    Effect.gen(function* () {
      const { read, tried } = failing(2);
      const fiber = yield* Effect.forkChild(retryVisitRead(read));
      yield* TestClock.adjust("2 seconds");
      expect(yield* Fiber.join(fiber)).toBe("frame");
      expect(tried()).toBe(3);
    })
  );

  it.effect("fails once the network has failed every try", () =>
    Effect.gen(function* () {
      const { read, tried } = failing(9);
      const fiber = yield* Effect.forkChild(retryVisitRead(read));
      yield* TestClock.adjust("2 seconds");
      expect(Exit.isFailure(yield* Fiber.await(fiber))).toBe(true);
      expect(tried()).toBe(3);
    })
  );
});

describe("frameOfNavigation", () => {
  /** A navigation that stays in the visit, and one that enters it. */
  const STAY = { cause: "stay", invalid: false } as const;
  const ENTER = { cause: "enter", invalid: false } as const;

  const PROFILE = {
    kind: "school",
    mascot: "cat.0.243e66.right.open",
    name: "Harapan",
    slug: "harapan",
    status: "active",
  } as const;

  const VISITOR = {
    _tag: "Visitor",
    locale: "en",
    profile: Schema.decodeSync(TenantProfile)(PROFILE),
    title: "Sign in to Harapan",
  } as const;

  /** The frame a visitor's entry page drew, and the text a browser keeps of it. */
  const DRAWN = { legal: LINKS, school: VISITOR };
  const KEPT_TEXT = jsonOf({
    legal: LINKS,
    school: { ...VISITOR, profile: PROFILE },
    sessionId: null,
  });

  /** The browser's storage, which holds the kept frame a test gives it. */
  const storage = { getItem: vi.fn(), removeItem: vi.fn(), setItem: vi.fn() };

  beforeEach(() => {
    fetcher
      .mockReset()
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 401 }))
      );
    frame.read.mockReset().mockReturnValue(Effect.succeed(VISITOR));
    staticData.read.mockReset().mockResolvedValue({
      pageNavigation: {
        dataProcessingPath: "data-processing-agreement",
        privacyPolicyPath: "privacy",
        termsOfServicePath: "terms",
      },
    });
    storage.getItem.mockReset().mockReturnValue(null);
    storage.removeItem.mockReset();
    storage.setItem.mockReset();
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("navigator", { languages: ["en"] });
    vi.stubGlobal("window", {
      localStorage: storage,
      location: { origin: "https://harapan.nakafa.com" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("answers the live frame that replaced a kept one, once, then the visit's own", async () => {
    const live = { legal: null, school: { _tag: "Refused" } } as const;
    const visit: SchoolVisit = { frame: DRAWN };

    confirmFrame(visit, live);

    await expect(frameOfNavigation(visit, SLUG, STAY)).resolves.toBe(live);
    await expect(frameOfNavigation(visit, SLUG, STAY)).resolves.toBe(DRAWN);
    expect(frame.read).not.toHaveBeenCalled();
  });

  it("reads the frame of a visit that enters the school, and keeps it for the next visit", async () => {
    const visit: SchoolVisit = { frame: DRAWN };

    await expect(frameOfNavigation(visit, SLUG, ENTER)).resolves.toEqual(DRAWN);

    expect(takeLiveRead(visit)).toBeUndefined();
    expect(storage.setItem).toHaveBeenCalledWith(
      KEPT_SCHOOL_KEY,
      expect.stringContaining('"sessionId":null')
    );
  });

  it("reads the frame again after a refresh invalidates the school", async () => {
    frame.read.mockReturnValueOnce(Effect.succeed({ _tag: "Refused" }));

    await expect(
      frameOfNavigation({ frame: DRAWN }, SLUG, { ...STAY, invalid: true })
    ).resolves.toEqual({ legal: null, school: { _tag: "Refused" } });

    expect(storage.removeItem).toHaveBeenCalledWith(KEPT_SCHOOL_KEY);
  });

  it("draws a kept frame at once, and hands its live read to one layout", async () => {
    storage.getItem.mockImplementation((key) =>
      key === KEPT_SCHOOL_KEY ? KEPT_TEXT : null
    );
    const visit: SchoolVisit = {};

    await expect(frameOfNavigation(visit, SLUG, STAY)).resolves.toEqual(DRAWN);

    await expect(takeLiveRead(visit)).resolves.toEqual(DRAWN);
    expect(takeLiveRead(visit)).toBeUndefined();
  });

  it("fails the visit once the legal links fail every try", async () => {
    vi.useFakeTimers();
    staticData.read.mockRejectedValue("offline");

    const read = expect(frameOfNavigation({}, SLUG, ENTER)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(2000);

    await read;
    expect(staticData.read).toHaveBeenCalledTimes(3);
  });
});
