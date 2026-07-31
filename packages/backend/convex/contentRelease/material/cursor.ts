import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { Effect, Schema } from "effect";

const MATERIAL_API_CURSOR_PREFIX = "material-v1:";

const MaterialApiCursorSchema = Schema.Struct({
  activeReleaseId: Schema.NullOr(ReleaseIdSchema),
  contentKey: ContentKeySchema,
  locale: ContentLocaleSchema,
  prefix: Schema.Union(Schema.Literal(""), ContentKeySchema),
});

/** Opaque material page position bound to one publication generation. */
export type MaterialApiCursor = typeof MaterialApiCursorSchema.Type;

/** Decodes and validates one opaque partner API continuation cursor. */
export const decodeMaterialApiCursor = Effect.fn(
  "contentRelease.decodeMaterialApiCursor"
)(function* (cursor: string | null) {
  if (cursor === null) {
    return null;
  }
  if (!cursor.startsWith(MATERIAL_API_CURSOR_PREFIX)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Material API cursor has an unsupported format."
    );
  }
  const payload = cursor.slice(MATERIAL_API_CURSOR_PREFIX.length);
  const [releaseId, locale, encodedPrefix, encodedContentKey, ...extra] =
    payload.split(":");
  if (
    releaseId === undefined ||
    locale === undefined ||
    encodedPrefix === undefined ||
    encodedContentKey === undefined ||
    extra.length > 0
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Material API cursor has an invalid identity."
    );
  }
  const decoded = yield* Effect.try({
    try: () => ({
      contentKey: decodeURIComponent(encodedContentKey),
      prefix: decodeURIComponent(encodedPrefix),
    }),
    catch: () =>
      new ReleaseError({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Material API cursor has an invalid identity.",
      }),
  });
  return yield* Schema.decodeUnknown(MaterialApiCursorSchema)({
    activeReleaseId: releaseId === "" ? null : releaseId,
    contentKey: decoded.contentKey,
    locale,
    prefix: decoded.prefix,
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Material API cursor has an invalid identity.",
        })
    )
  );
});

/** Encodes one validated partner API position as an opaque cursor. */
export const encodeMaterialApiCursor = Effect.fn(
  "contentRelease.encodeMaterialApiCursor"
)(function* (input: {
  readonly activeReleaseId: null | string;
  readonly contentKey: string;
  readonly locale: string;
  readonly prefix: string;
}) {
  const cursor = yield* Schema.decodeUnknown(MaterialApiCursorSchema)(
    input
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Material API page produced an invalid cursor identity.",
        })
    )
  );
  return `${MATERIAL_API_CURSOR_PREFIX}${cursor.activeReleaseId ?? ""}:${cursor.locale}:${encodeURIComponent(cursor.prefix)}:${encodeURIComponent(cursor.contentKey)}`;
});
