import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { MascotCode } from "@repo/mascot/code";
import { Effect, Option, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";
import { KNOWN_SCHOOLS_KEY } from "@/lib/auth/keys";

/** One school of the account menu: what its row shows and where it leads. */
const KnownSchool = Schema.Struct({
  logo: Schema.optionalKey(Schema.String),
  mascot: MascotCode,
  name: Schema.String,
  slug: TenantSlug,
});

/** One school as the account menu draws it. */
export type KnownSchool = typeof KnownSchool.Type;

/**
 * The schools the account menu last showed for one session. The live list reads
 * again each time a menu mounts, and a read answers after the menu has opened,
 * so the menu draws these until it does.
 */
const KnownSchools = Schema.Struct({
  schools: Schema.Array(KnownSchool),
  sessionId: Schema.String,
});

const KnownSchoolsText = Schema.fromJsonString(KnownSchools);

const decodeKnownSchoolsText = Schema.decodeUnknownOption(KnownSchoolsText);

const encodeKnownSchoolsText = Schema.encodeEffect(KnownSchoolsText);

type SchoolStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Reads the stored schools as their text, or null when the browser holds none.
 * A storage that cannot be read answers null too, and the failure is reported
 * with its cause.
 */
export const loadKnownSchoolsText = Effect.fn("www.identity.loadKnownSchools")(
  function* (storage?: SchoolStorage) {
    return yield* Effect.try(() =>
      (storage ?? window.localStorage).getItem(KNOWN_SCHOOLS_KEY)
    ).pipe(
      Effect.catch((cause) =>
        reportClientException(cause, {
          operation: "load",
          source: "identity.knownSchools",
        }).pipe(Effect.as(null))
      )
    );
  }
);

/**
 * The stored schools of `sessionId`, or none. Schools of another session, a list
 * in a shape this page no longer reads, and no session at all answer none, so
 * the menu never draws a school the session does not hold.
 */
export function readKnownSchools(
  text: string | null,
  sessionId: string | null
) {
  return Option.fromNullishOr(text).pipe(
    Option.flatMap(decodeKnownSchoolsText),
    Option.filter((known) => known.sessionId === sessionId),
    Option.match({
      onNone: () => [],
      onSome: (known) => known.schools,
    })
  );
}

/**
 * Keeps the schools the live list answered for a session, so the next menu draws
 * them in its first frame. A write that fails is reported with its cause.
 */
export const saveKnownSchools = Effect.fn("www.identity.saveKnownSchools")(
  function* (
    sessionId: string,
    schools: readonly KnownSchool[],
    storage?: SchoolStorage
  ) {
    const text = yield* encodeKnownSchoolsText({ schools, sessionId });
    yield* Effect.try(() =>
      (storage ?? window.localStorage).setItem(KNOWN_SCHOOLS_KEY, text)
    );
  },
  Effect.catch((cause) =>
    reportClientException(cause, {
      operation: "save",
      source: "identity.knownSchools",
    })
  )
);
