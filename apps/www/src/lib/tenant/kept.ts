import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Effect, Option, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";
import { KEPT_SCHOOL_KEY } from "@/lib/auth/keys";
import { AuthLegalLinksSchema } from "@/lib/auth/legal";
import { SchoolFrameSchema } from "@/lib/tenant/frame";

/**
 * The frame a school host's layout last drew, with the legal links of a visitor's entry page and the session it
 * drew it for: the session the Convex token named, or none for a visitor. It holds what the shell shows and no
 * email, as the viewer's view holds none.
 */
const KeptFrame = Schema.Struct({
  legal: Schema.NullOr(AuthLegalLinksSchema),
  school: SchoolFrameSchema,
  sessionId: Schema.NullOr(Schema.String),
});

/** The kept frame as the school host stores it. */
export type KeptFrame = typeof KeptFrame.Type;

const KeptFrameText = Schema.fromJsonString(KeptFrame);

const decodeKeptFrame = Schema.decodeUnknownOption(KeptFrameText);

const encodeKeptFrame = Schema.encodeSync(KeptFrameText);

/** What the page knows before it reads anything: the sign-in hint, the session it last had, and its locale. */
const KeptFrameReader = Schema.Struct({
  known: Schema.NullOr(Schema.String),
  locale: LocaleSchema,
  signedIn: Schema.Boolean,
});

type KeptFrameReader = typeof KeptFrameReader.Type;

/**
 * The kept frame a visit may draw at once, or none. A signed-in browser draws the frame kept for the session it
 * holds, and a signed-out one the frame kept for a visitor, each only in the locale it was drawn in, so a frame of
 * another session, an ended session, another locale or a shape this page no longer reads is never drawn. The visit
 * reads the school again at once and replaces the frame where the answer differs.
 */
export function keptFrameFor(text: string | null, reader: KeptFrameReader) {
  return Option.fromNullishOr(text).pipe(
    Option.flatMap(decodeKeptFrame),
    Option.filter(
      (kept) =>
        kept.school.locale === reader.locale &&
        (reader.signedIn
          ? kept.sessionId !== null && kept.sessionId === reader.known
          : kept.sessionId === null && kept.school._tag === "Visitor")
    )
  );
}

/** Whether two frames show the same school, the same viewer and the same legal links, so a visit keeps what it drew. */
export function isSameFrame(
  first: Pick<KeptFrame, "legal" | "school">,
  second: Pick<KeptFrame, "legal" | "school">
) {
  return (
    encodeKeptFrame({ ...first, sessionId: null }) ===
    encodeKeptFrame({ ...second, sessionId: null })
  );
}

type KeptFrameStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

/**
 * Reads the stored frame as its text, or null when the host holds none. A storage that cannot be read answers null
 * too, and the failure is reported with its cause.
 */
export const loadKeptFrameText = Effect.fn("www.tenant.loadKeptFrame")(
  function* (storage?: KeptFrameStorage) {
    return yield* Effect.try(() =>
      (storage ?? window.localStorage).getItem(KEPT_SCHOOL_KEY)
    ).pipe(
      Effect.catch((cause) =>
        reportClientException(cause, {
          operation: "load",
          source: "tenant.keptFrame",
        }).pipe(Effect.as(null))
      )
    );
  }
);

/**
 * Keeps the frame a visit read for the next visit of the host, with the session it was read for. A storage write
 * that fails is reported with its cause, and the visit goes on.
 */
export const saveKeptFrame = Effect.fn("www.tenant.saveKeptFrame")(function* (
  kept: KeptFrame,
  storage?: KeptFrameStorage
) {
  yield* Effect.try(() =>
    (storage ?? window.localStorage).setItem(
      KEPT_SCHOOL_KEY,
      encodeKeptFrame(kept)
    )
  ).pipe(
    Effect.catch((cause) =>
      reportClientException(cause, {
        operation: "save",
        source: "tenant.keptFrame",
      })
    )
  );
});

/**
 * Forgets the host's kept frame once the school refuses the visit, so the next visit draws no school it may not open.
 * A storage write that fails is reported with its cause.
 */
export const dropKeptFrame = Effect.fn("www.tenant.dropKeptFrame")(function* (
  storage?: KeptFrameStorage
) {
  yield* Effect.try(() =>
    (storage ?? window.localStorage).removeItem(KEPT_SCHOOL_KEY)
  ).pipe(
    Effect.catch((cause) =>
      reportClientException(cause, {
        operation: "drop",
        source: "tenant.keptFrame",
      })
    )
  );
});
