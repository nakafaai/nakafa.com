import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
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
  const projection = yield* Schema.decodeUnknown(
    MaterialLessonProjectionSchema
  )(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => makeMaterialProjectionError(identity))
  );
  if (
    projection.locale !== identity.locale ||
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
    return yield* Schema.decodeUnknown(MaterialLessonProjectionSchema)(input, {
      onExcessProperty: "error",
    }).pipe(Effect.mapError(() => makeMaterialProjectionError(identity)));
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
    locale: catalog.projection.locale,
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
    current.locale === candidate.locale &&
    current.materialKey === candidate.materialKey &&
    current.parentPath === candidate.parentPath
  );
}
