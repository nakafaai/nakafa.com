import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
  type MaterialMetadata,
} from "@nakafa/aksara-contracts/projection/material";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect, Schema } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  PublishedProjectionError,
  type PublishedProjectionIdentity,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";

interface MaterialPublicationRead {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly projection: MaterialLessonProjection;
}

/** Adapts one decoded signed projection to Nakafa's current material metadata. */
export function normalizeMaterialMetadata(
  metadata: MaterialLessonProjection["metadata"]
): MaterialMetadata {
  return {
    authors: metadata.authors,
    ...normalizePublicationDates(metadata),
    ...(metadata.description === undefined
      ? {}
      : { description: metadata.description }),
    ...(metadata.subject === undefined ? {} : { subject: metadata.subject }),
    title: metadata.title,
  };
}
/** Creates the public failure returned for malformed material projection data. */
export function makeMaterialProjectionError(
  identity: PublishedProjectionIdentity
) {
  return new PublishedProjectionError(identity);
}
/** Strictly decodes one material projection and its requested route identity. */
export const decodeMaterialProjection = Effect.fn(
  "NakafaMaterial.decodeProjection"
)(function* (input: unknown, identity: PublishedProjectionIdentity) {
  const projection = yield* Schema.decodeUnknownEffect(
    MaterialLessonProjectionSchema
  )(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => makeMaterialProjectionError(identity))
  );
  if (
    projection.appLocale !== identity.appLocale ||
    projection.publicPath !== identity.publicPath
  ) {
    return yield* makeMaterialProjectionError(identity);
  }
  return projection;
});
/** Parses one canonical material projection encoded by the backend. */
export const decodeMaterialJson = Effect.fn("NakafaMaterial.decodeJson")(
  function* (source: string, identity: PublishedProjectionIdentity) {
    const input = yield* Effect.try({
      catch: () => makeMaterialProjectionError(identity),
      try: (): unknown => JSON.parse(source),
    });
    return yield* Schema.decodeUnknownEffect(MaterialLessonProjectionSchema)(
      input,
      {
        onExcessProperty: "error",
      }
    ).pipe(Effect.mapError(() => makeMaterialProjectionError(identity)));
  }
);
/** Proves two concurrent material reads selected one identical publication. */
export const verifyMaterialPublication = Effect.fn(
  "NakafaMaterial.verifyPublication"
)(function* (
  catalog: MaterialPublicationRead,
  runtime: MaterialPublicationRead
) {
  const identity = {
    appLocale: catalog.projection.appLocale,
    publicPath: catalog.projection.publicPath,
  };
  if (runtime.activeReleaseId !== catalog.activeReleaseId) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: runtime.activeReleaseId,
      expectedReleaseId: catalog.activeReleaseId,
    });
  }
  if (
    canonicalizeMaterialProjection(runtime.projection) !==
    canonicalizeMaterialProjection(catalog.projection)
  ) {
    return yield* makeMaterialProjectionError(identity);
  }
});
/** Checks whether two material projections share one stable content identity. */
export function isMaterialCounterpart(
  current: MaterialLessonProjection,
  candidate: MaterialLessonProjection
) {
  return current.contentKey === candidate.contentKey;
}
/** Checks whether two projections belong to one localized lesson group. */
export function isMaterialSibling(
  current: MaterialLessonProjection,
  candidate: MaterialLessonProjection
) {
  return (
    current.appLocale === candidate.appLocale &&
    current.materialKey === candidate.materialKey &&
    current.parentPath === candidate.parentPath
  );
}
