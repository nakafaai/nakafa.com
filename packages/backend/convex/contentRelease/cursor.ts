import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import { Effect, Schema } from "effect";

const PAGE_CURSOR_PREFIX = "publication-page:";
const PageCursorSchema = Schema.Tuple([
  Schema.Literals(["category", "material"]),
  Schema.Literals(["blue", "green"]),
  Schema.String,
]);

export type PageCursorKind = (typeof PageCursorSchema.Type)[0];

/** Immutable active release identity bound to a native pagination cursor. */
export interface ReleaseCursorIdentity {
  readonly manifestHash: string;
  readonly releaseId: string;
}

/** Checks whether one continuation cursor belongs to a superseded release. */
export function hasStaleReleaseCursor(
  cursor: null | string,
  expectedManifestHash: null | string,
  expectedReleaseId: null | string,
  active: null | ReleaseCursorIdentity
) {
  return (
    cursor !== null &&
    (!active ||
      expectedManifestHash !== active.manifestHash ||
      expectedReleaseId !== active.releaseId)
  );
}

/** Recognizes native cursors wrapped by the stable publication-page contract. */
export function hasPageCursorPrefix(cursor: null | string) {
  return cursor === null || cursor.startsWith(PAGE_CURSOR_PREFIX);
}

/** Decodes one native cursor only for its exact read-model query. */
export const decodePageCursor = Effect.fn("contentRelease.decodePageCursor")(
  function* (
    cursor: null | string,
    expectedKind: PageCursorKind,
    expectedSlot: ModelSlot
  ) {
    if (cursor === null) {
      return null;
    }
    if (!cursor.startsWith(PAGE_CURSOR_PREFIX)) {
      return yield* invalidPageCursor("an unsupported format");
    }
    const parsed = yield* Effect.try({
      try: (): unknown => JSON.parse(cursor.slice(PAGE_CURSOR_PREFIX.length)),
      catch: () => pageCursorError("an invalid position"),
    });
    const [kind, slot, nativeCursor] = yield* Schema.decodeUnknownEffect(
      PageCursorSchema
    )(parsed).pipe(
      Effect.mapError(() => pageCursorError("an invalid position"))
    );
    if (kind !== expectedKind || slot !== expectedSlot) {
      return yield* invalidPageCursor("a stale query identity");
    }
    return nativeCursor;
  }
);

/** Encodes one native cursor with its stable query and slot identity. */
export function encodePageCursor(
  kind: PageCursorKind,
  slot: ModelSlot,
  cursor: string
) {
  return `${PAGE_CURSOR_PREFIX}${JSON.stringify([kind, slot, cursor])}`;
}

/** Rejects continuation cursors whose active release identity changed. */
export const validateReleaseCursor = Effect.fn(
  "contentRelease.validateReleaseCursor"
)(function* (
  cursor: null | string,
  expectedManifestHash: null | string,
  expectedReleaseId: null | string,
  active: null | ReleaseCursorIdentity
) {
  if (cursor === null) {
    if (expectedManifestHash !== null || expectedReleaseId !== null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        "An initial content page cannot claim a release cursor."
      );
    }
    return;
  }
  if (
    hasStaleReleaseCursor(
      cursor,
      expectedManifestHash,
      expectedReleaseId,
      active
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STALE_BASE",
      "The active content release changed during pagination."
    );
  }
});

/** Creates one typed publication-page cursor failure. */
function invalidPageCursor(reason: string) {
  return Effect.fail(pageCursorError(reason));
}

/** Creates one stable publication-page cursor integrity error. */
function pageCursorError(reason: string) {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message: `Publication page cursor has ${reason}.`,
  });
}
