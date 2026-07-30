import {
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Exact public identity used to report malformed material projections. */
export interface MaterialProjectionIdentity {
  readonly locale: Locale;
  readonly publicPath: string;
}

/** Creates the public failure returned for malformed material projection data. */
export function makeMaterialProjectionError(
  identity: MaterialProjectionIdentity
) {
  return new PublishedProjectionError(identity);
}

/** Strictly decodes one material projection and its requested route identity. */
export const decodeMaterialProjection = Effect.fn(
  "NakafaMaterial.decodeProjection"
)(function* (input: unknown, identity: MaterialProjectionIdentity) {
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
  function* (source: string, identity: MaterialProjectionIdentity) {
    const input = yield* Effect.try({
      catch: () => makeMaterialProjectionError(identity),
      try: (): unknown => JSON.parse(source),
    });
    return yield* Schema.decodeUnknown(MaterialLessonProjectionSchema)(input, {
      onExcessProperty: "error",
    }).pipe(Effect.mapError(() => makeMaterialProjectionError(identity)));
  }
);

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
