import {
  canonicalizeContentProjection,
  familyForProjection,
  type RoutedContentProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import { ContentHeadSchema } from "@nakafa/aksara-contracts/release/head";
import {
  type PublicationRow,
  PublicationSource,
} from "@repo/backend/content/publication/source";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect, Option, Schema } from "effect";

/** Converts one complete immutable upsert version into a compact head. */
const decodeContentHead = Effect.fn("contentRelease.decodeContentHead")(
  function* (head: PublicationRow<"contentHeads">, publicPath?: string) {
    if (
      head.operation !== "upsert" ||
      !head.artifactHash ||
      !head.compilerConfigHash ||
      !head.delivery ||
      !head.projectionHash ||
      !head.projectionJson ||
      !head.rendererDomain ||
      !head.sourceHash ||
      !head.sourcePath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content version ${head.contentKey}/${head.artifactLocale}/${head.sequence} is incomplete.`
      );
    }
    return yield* Schema.decodeEffect(ContentHeadSchema)({
      artifactHash: head.artifactHash,
      artifactLocale: head.artifactLocale,
      compilerConfigHash: head.compilerConfigHash,
      contentKey: head.contentKey,
      delivery: head.delivery,
      family: head.family,
      projectionHash: head.projectionHash,
      ...(publicPath === undefined ? {} : { publicPath }),
      rendererDomain: head.rendererDomain,
      sourceHash: head.sourceHash,
      sourcePath: head.sourcePath,
    }).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Content version ${head.contentKey}/${head.artifactLocale}/${head.sequence} violates the content-head contract.`,
          })
      )
    );
  }
);
/** Decodes one projection and binds it to its stored family and artifact locale. */
const decodeHeadProjection = Effect.fn("contentRelease.decodeHeadProjection")(
  function* (head: PublicationRow<"contentHeads">) {
    if (!head.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content ${head.contentKey}/${head.artifactLocale} lost its projection.`
      );
    }
    const projection = yield* decodeProjectionJson(head.projectionJson);
    if (familyForProjection(projection) !== head.family) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content ${head.contentKey}/${head.artifactLocale} changed projection family.`
      );
    }
    if (projection.artifactLocale !== head.artifactLocale) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content ${head.contentKey}/${head.artifactLocale} changed projection locale.`
      );
    }
    return projection;
  }
);
/** Resolves and validates one content head's canonical published route. */
const resolvePublicPath = Effect.fn("contentRelease.resolvePublicPath")(
  function* (
    head: PublicationRow<"contentHeads">,
    projection: RoutedContentProjection,
    activeSequence: number
  ) {
    const binding = Option.getOrNull(
      yield* (yield* PublicationSource).binding(
        projection.appLocale,
        projection.publicPath,
        activeSequence
      )
    );
    if (
      binding?.operation !== "bind" ||
      binding.contentKey !== head.contentKey
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Content ${head.contentKey}/${head.artifactLocale} lost its canonical route.`
      );
    }
    if (
      binding.sequence === head.sequence &&
      binding.releaseId !== head.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route for ${head.contentKey}/${head.artifactLocale} disagrees at one sequence.`
      );
    }
    return projection.publicPath;
  }
);
/** Resolves one exact public projection selected by a frozen sequence. */
export const resolvePublicProjection = Effect.fn(
  "contentRelease.resolvePublicProjection"
)(function* (
  contentKey: string,
  artifactLocale: Doc<"contentKeys">["artifactLocale"],
  sequence: number
) {
  const head = Option.getOrNull(
    yield* (yield* PublicationSource).version(
      contentKey,
      artifactLocale,
      sequence
    )
  );
  if (!head || head.operation === "delete" || head.delivery !== "public") {
    return null;
  }
  if (!(head.projectionHash && head.projectionJson)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Public content ${contentKey}/${artifactLocale} lost its projection.`
    );
  }
  const projection = yield* decodeHeadProjection(head);
  if (projection.kind === "question-body") {
    return null;
  }
  const publicPath = yield* resolvePublicPath(head, projection, sequence);
  const projectionHash = yield* hashText(
    "the public content projection",
    canonicalizeContentProjection(projection)
  );
  if (
    projection.contentKey !== head.contentKey ||
    projectionHash !== head.projectionHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Public content ${contentKey}/${artifactLocale} has mismatched projection data.`
    );
  }
  if (!(head.rendererDomain && head.sourcePath)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Public content ${contentKey}/${artifactLocale} lost its renderer provenance.`
    );
  }
  return {
    appLocale: projection.appLocale,
    artifactHash: head.artifactHash,
    artifactLocale: head.artifactLocale,
    contentKey: head.contentKey,
    family: head.family,
    projection,
    projectionHash,
    projectionJson: head.projectionJson,
    publicPath,
    releaseId: head.releaseId,
    rendererDomain: head.rendererDomain,
    sequence: head.sequence,
    sourcePath: head.sourcePath,
  };
});
/** Authenticates one already-loaded version through its frozen publication sequence. */
export const contentHead = Effect.fn("contentRelease.contentHead")(function* (
  head: PublicationRow<"contentHeads">,
  activeSequence: number
) {
  const projection = yield* decodeHeadProjection(head);
  const publicPath =
    projection.kind === "question-body"
      ? undefined
      : yield* resolvePublicPath(head, projection, activeSequence);
  return yield* decodeContentHead(head, publicPath);
});
/** Resolves one effective immutable head from a frozen sequence snapshot. */
export const resolveContentHead = Effect.fn(
  "contentRelease.resolveContentHead"
)(function* (
  contentKey: string,
  artifactLocale: Doc<"contentKeys">["artifactLocale"],
  sequence: number
) {
  const head = Option.getOrNull(
    yield* (yield* PublicationSource).version(
      contentKey,
      artifactLocale,
      sequence
    )
  );
  if (!head || head.operation === "delete") {
    return null;
  }
  return yield* contentHead(head, sequence);
});
