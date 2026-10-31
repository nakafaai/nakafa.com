import { afterEach, describe, expect, it } from "@effect/vitest";
import { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { Effect, Option, Schema } from "effect";
import type { reportClientException } from "@/lib/analytics/client";
import { KEPT_SCHOOL_KEY } from "@/lib/auth/keys";
import {
  dropKeptFrame,
  isSameFrame,
  type KeptFrame,
  keptFrameFor,
  loadKeptFrameText,
  saveKeptFrame,
} from "@/lib/tenant/kept";

const PROFILE = Schema.decodeSync(TenantProfile)({
  kind: "school",
  mascot: "cat.0.243e66.right.open",
  name: "Harapan",
  slug: "harapan",
  status: "active",
});

const LINKS = {
  privacy: "https://nakafa.com/en/privacy",
  terms: "https://nakafa.com/en/terms",
};

/** The frame a visitor's entry page drew, kept with no session. */
const VISITOR: KeptFrame = {
  legal: LINKS,
  school: {
    _tag: "Visitor",
    locale: "en",
    profile: PROFILE,
    title: "Sign in to Harapan",
  },
  sessionId: null,
};

/** The frame an outsider's page drew, kept for the session `session-ayu`. */
const OUTSIDER: KeptFrame = {
  legal: null,
  school: { _tag: "Outsider", account: "Ayu", locale: "en", profile: PROFILE },
  sessionId: "session-ayu",
};

const reportClientExceptionMock = vi.hoisted(() =>
  vi.fn<typeof reportClientException>(() => Effect.void)
);
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: reportClientExceptionMock,
}));

/** The text a host stores for a kept frame, written and read back as a visit does. */
const textOf = (kept: KeptFrame) =>
  Effect.runSync(saveKeptFrame(kept).pipe(Effect.andThen(loadKeptFrameText())));

/** A storage the browser refuses to hand out or to use, as with storage turned off. */
const refusing = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  removeItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
};

afterEach(() => {
  window.localStorage.clear();
  reportClientExceptionMock.mockClear();
});

describe("keptFrameFor", () => {
  it("draws the frame kept for the session the signed-in browser holds, in its locale", () => {
    expect(
      keptFrameFor(textOf(OUTSIDER), {
        known: "session-ayu",
        locale: "en",
        signedIn: true,
      })
    ).toEqual(Option.some(OUTSIDER));
  });

  it("draws a visitor's kept frame for a browser that the hint says is signed out", () => {
    expect(
      keptFrameFor(textOf(VISITOR), {
        known: null,
        locale: "en",
        signedIn: false,
      })
    ).toEqual(Option.some(VISITOR));
  });

  it("draws nothing for another session, a visitor's frame once signed in, another locale, or a text it cannot read", () => {
    const signedIn = {
      known: "session-ayu",
      locale: "en",
      signedIn: true,
    } as const;
    expect(
      keptFrameFor(textOf(OUTSIDER), { ...signedIn, known: "session-budi" })
    ).toEqual(Option.none());
    expect(keptFrameFor(textOf(VISITOR), signedIn)).toEqual(Option.none());
    expect(
      keptFrameFor(textOf(OUTSIDER), { ...signedIn, locale: "id" })
    ).toEqual(Option.none());
    expect(keptFrameFor("{", signedIn)).toEqual(Option.none());
    expect(keptFrameFor(null, signedIn)).toEqual(Option.none());
  });

  it("draws no signed-in frame for a browser the hint says is signed out", () => {
    expect(
      keptFrameFor(textOf(OUTSIDER), {
        known: "session-ayu",
        locale: "en",
        signedIn: false,
      })
    ).toEqual(Option.none());
  });
});

describe("isSameFrame", () => {
  it("holds for frames that show the same school and links, whatever session they were kept for", () => {
    const another: KeptFrame = { ...VISITOR, sessionId: "session-budi" };
    expect(isSameFrame(VISITOR, another)).toBe(true);
    expect(isSameFrame(VISITOR, { ...VISITOR, legal: null })).toBe(false);
    expect(isSameFrame(VISITOR, OUTSIDER)).toBe(false);
  });
});

describe("the kept frame in storage", () => {
  it.effect("keeps a frame, reads it back, and forgets it", () =>
    Effect.gen(function* () {
      yield* saveKeptFrame(OUTSIDER);
      expect(
        keptFrameFor(yield* loadKeptFrameText(), {
          known: "session-ayu",
          locale: "en",
          signedIn: true,
        })
      ).toEqual(Option.some(OUTSIDER));
      yield* dropKeptFrame();
      expect(window.localStorage.getItem(KEPT_SCHOOL_KEY)).toBeNull();
      expect(yield* loadKeptFrameText()).toBeNull();
    })
  );

  it.effect(
    "goes on without a kept frame when the storage refuses, and reports each refusal",
    () =>
      Effect.gen(function* () {
        expect(yield* loadKeptFrameText(refusing)).toBeNull();
        yield* saveKeptFrame(VISITOR, refusing);
        yield* dropKeptFrame(refusing);
        expect(
          reportClientExceptionMock.mock.calls.map(([, context]) => context)
        ).toEqual([
          { operation: "load", source: "tenant.keptFrame" },
          { operation: "save", source: "tenant.keptFrame" },
          { operation: "drop", source: "tenant.keptFrame" },
        ]);
      })
  );
});
