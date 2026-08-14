import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  ContentKeySchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { Effect, Schema } from "effect";

const PARTNER_CURSOR_PREFIX = "content:";

const PartnerCursorSchema = Schema.Struct({
  appLocale: AppLocaleSchema,
  activeReleaseId: ReleaseIdSchema,
  contentKey: ContentKeySchema,
  family: Schema.Literal("article", "material"),
  prefix: Schema.Union(Schema.Literal(""), ContentKeySchema),
});

/** Opaque partner API position bound to one current publication generation. */
export type PartnerCursor = typeof PartnerCursorSchema.Type;

/** Decodes one unversioned current partner pagination cursor. */
export const decodePartnerCursor = Effect.fn(
  "contentRelease.decodePartnerCursor"
)(function* (cursor: string | null) {
  if (cursor === null) {
    return null;
  }
  if (!cursor.startsWith(PARTNER_CURSOR_PREFIX)) {
    return yield* invalidCursor(
      "Partner API cursor has an unsupported format."
    );
  }
  const payload = cursor.slice(PARTNER_CURSOR_PREFIX.length);
  const [
    family,
    releaseId,
    appLocale,
    encodedPrefix,
    encodedContentKey,
    ...extra
  ] = payload.split(":");
  if (
    family === undefined ||
    releaseId === undefined ||
    appLocale === undefined ||
    encodedPrefix === undefined ||
    encodedContentKey === undefined ||
    extra.length > 0
  ) {
    return yield* invalidCursor("Partner API cursor has an invalid identity.");
  }
  const decoded = yield* Effect.try({
    try: () => ({
      contentKey: decodeURIComponent(encodedContentKey),
      prefix: decodeURIComponent(encodedPrefix),
    }),
    catch: () =>
      new ReleaseError({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Partner API cursor has an invalid identity.",
      }),
  });
  return yield* Schema.decodeUnknown(PartnerCursorSchema)({
    appLocale,
    activeReleaseId: releaseId,
    contentKey: decoded.contentKey,
    family,
    prefix: decoded.prefix,
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Partner API cursor has an invalid identity.",
        })
    )
  );
});

/** Encodes one validated current partner pagination position. */
export const encodePartnerCursor = Effect.fn(
  "contentRelease.encodePartnerCursor"
)(function* (input: {
  readonly appLocale: string;
  readonly activeReleaseId: string;
  readonly contentKey: string;
  readonly family: "article" | "material";
  readonly prefix: string;
}) {
  const cursor = yield* Schema.decodeUnknown(PartnerCursorSchema)(input).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Partner API page produced an invalid cursor identity.",
        })
    )
  );
  return `${PARTNER_CURSOR_PREFIX}${cursor.family}:${cursor.activeReleaseId}:${cursor.appLocale}:${encodeURIComponent(cursor.prefix)}:${encodeURIComponent(cursor.contentKey)}`;
});

/** Produces one typed cursor failure without accepting historical formats. */
function invalidCursor(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
