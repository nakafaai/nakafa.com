import type contentReleasesTable from "@repo/backend/confect/_generated/tables/contentReleases";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

const PAGE_CURSOR_PREFIX = "publication-page:";
const PageCursorSchema = Schema.Tuple([
  Schema.Literals(["category", "material"]),
  Schema.Literals(["blue", "green"]),
  Schema.String,
]);
type PageCursorKind = (typeof PageCursorSchema.Type)[0];

/** Immutable active release identity bound to a native pagination cursor. */
type ReleaseCursorIdentity = Pick<
  typeof contentReleasesTable.Doc.Type,
  "manifestHash" | "releaseId"
>;

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
    const [kind, slot, nativeCursor] = yield* Schema.decodeEffect(
      Schema.fromJsonString(PageCursorSchema)
    )(cursor.slice(PAGE_CURSOR_PREFIX.length)).pipe(
      Effect.mapError(() => pageCursorError("an invalid position"))
    );
    if (kind !== expectedKind || slot !== expectedSlot) {
      return yield* pageCursorError("a stale query identity");
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
  const text = encodeJsonText([kind, slot, cursor]);
  return `${PAGE_CURSOR_PREFIX}${text}`;
}

/** Rejects an initial page that claims a continuation's release identity. */
export const validateInitialPage = Effect.fn(
  "contentRelease.validateInitialPage"
)(function* (
  cursor: null | string,
  expectedManifestHash: null | string,
  expectedReleaseId: null | string
) {
  if (
    cursor === null &&
    (expectedManifestHash !== null || expectedReleaseId !== null)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      "An initial content page cannot claim a release cursor."
    );
  }
});

/** Creates one stable publication-page cursor integrity error. */
function pageCursorError(reason: string) {
  return ReleaseError.make({
    code: "CONTENT_RELEASE_INTEGRITY",
    message: `Publication page cursor has ${reason}.`,
  });
}
