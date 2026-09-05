import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeRequestSchema,
  type ProtectedContentRuntimeSelector,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import {
  type PublicationRow,
  PublicationSource,
} from "@repo/backend/content/publication/source";
import { loadVerifiedSnapshot } from "@repo/backend/content/snapshot/read";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  decodeArtifactJson,
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { verifyTryoutPlacement } from "@repo/backend/convex/contentRelease/tryout/verify";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect, Option, Schema } from "effect";

const protectedDeliveryValidator = v.union(
  v.literal("authenticated"),
  v.literal("entitled")
);
const protectedSelectorValidator = v.object({
  artifactHash: v.string(),
  contentKey: v.string(),
  delivery: protectedDeliveryValidator,
});
export const protectedArgsValidator = {
  bundleHash: v.string(),
  selectors: v.array(protectedSelectorValidator),
  snapshotId: v.string(),
};
const protectedItemValidator = v.object({
  artifactJson: v.string(),
  delivery: protectedDeliveryValidator,
  sourcePath: v.string(),
});
export const protectedResultValidator = v.union(
  v.null(),
  v.object({
    bundleJson: v.string(),
    items: v.array(protectedItemValidator),
    rendererJson: v.string(),
  })
);

/** Stored protected batch returned only through one internal query. */
export type ProtectedRuntimeBatchRow = Infer<typeof protectedResultValidator>;

interface ProtectedBodyIdentity {
  readonly artifactHash: string;
  readonly artifactLocale: TryoutPlacement["answerArtifactLocale"];
  readonly contentKey: string;
  readonly kind: "answer" | "question";
}

interface ProtectedPlacementSelection {
  readonly placement: PublicationRow<"tryoutPlacements">;
  readonly selector: ProtectedContentRuntimeSelector;
}

/** Selects one retained placement through its exact body artifact identity. */
const loadPlacement = Effect.fn("contentRelease.loadProtectedPlacement")(
  function* (
    request: ProtectedContentRuntimeRequest,
    selector: ProtectedContentRuntimeSelector
  ) {
    return Option.getOrNull(
      yield* (yield* TryoutSource).body(request.snapshotId, selector)
    );
  }
);

/** Derives the exact signed identity owned by one placement body. */
function bodyIdentity(
  placement: TryoutPlacement,
  delivery: ProtectedContentRuntimeSelector["delivery"]
): ProtectedBodyIdentity {
  if (delivery === "authenticated") {
    return {
      artifactHash: placement.questionArtifactHash,
      artifactLocale: placement.questionArtifactLocale,
      contentKey: placement.questionContentKey,
      kind: "question",
    };
  }
  return {
    artifactHash: placement.answerArtifactHash,
    artifactLocale: placement.answerArtifactLocale,
    contentKey: placement.answerContentKey,
    kind: "answer",
  };
}

/** Loads one immutable artifact after exact retained-snapshot membership checks. */
const resolveProtectedItem = Effect.fn("contentRelease.resolveProtectedItem")(
  function* (
    request: ProtectedContentRuntimeRequest,
    selector: ProtectedContentRuntimeSelector,
    storedPlacement: PublicationRow<"tryoutPlacements">
  ) {
    const placement = yield* verifyTryoutPlacement(
      storedPlacement,
      request.snapshotId
    );
    const body = bodyIdentity(placement, selector.delivery);
    const sourcePath = `${placement.questionSourcePath}/${body.kind}.${body.artifactLocale}.mdx`;
    if (
      body.artifactHash !== selector.artifactHash ||
      body.contentKey !== selector.contentKey
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Protected try-out body ${selector.contentKey} changed its snapshot identity.`
      );
    }
    const storedArtifact = Option.getOrNull(
      yield* (yield* PublicationSource).artifact(selector.artifactHash)
    );
    if (!storedArtifact) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Protected try-out body ${selector.contentKey} lost its artifact.`
      );
    }
    const artifact = yield* decodeArtifactJson(storedArtifact.artifactJson);
    if (
      artifact.artifactHash !== selector.artifactHash ||
      artifact.payload.contentKey !== selector.contentKey ||
      artifact.payload.artifactLocale !== body.artifactLocale ||
      artifact.payload.rendererDomain !== placement.rendererDomain
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Protected try-out body ${selector.contentKey} has mismatched content.`
      );
    }
    return {
      artifactJson: storedArtifact.artifactJson,
      delivery: selector.delivery,
      sourcePath,
    };
  }
);

/** Loads and checks the permanent bundle selected by one attempt. */
const loadBundle = Effect.fn("contentRelease.loadProtectedBundle")(function* (
  request: ProtectedContentRuntimeRequest
) {
  const stored = Option.getOrNull(
    yield* (yield* TryoutSource).bundle(request.bundleHash)
  );
  if (!stored) {
    return null;
  }
  const [bundle, renderer] = yield* Effect.all([
    decodeTryoutRuntimeBundleJson(stored.bundleJson),
    decodeRendererJson(stored.rendererJson),
  ]);
  if (
    stored.bundleHash !== bundle.bundleHash ||
    stored.bundleHash !== request.bundleHash ||
    stored.snapshotId !== bundle.payload.snapshot.snapshotId ||
    stored.snapshotId !== request.snapshotId ||
    stored.rendererManifestHash !== bundle.payload.rendererManifestHash ||
    stored.rendererManifestHash !== renderer.hash ||
    stored.sourceGitSha !== bundle.payload.sourceGitSha ||
    stored.sourceManifestHash !== bundle.payload.sourceManifestHash ||
    stored.sourceReleaseId !== bundle.payload.sourceReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Protected try-out bundle ${request.bundleHash} changed its identity.`
    );
  }
  return stored;
});

/** Decodes and resolves one complete protected batch in a single transaction. */
export const readProtectedProgram = Effect.fn(
  "contentRelease.readProtectedBatch"
)(function* (input: unknown) {
  const request = yield* Schema.decodeUnknownEffect(
    ProtectedContentRuntimeRequestSchema,
    { onExcessProperty: "error" }
  )(input).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Protected runtime request is invalid.",
        })
    )
  );
  const bundle = yield* loadBundle(request);
  if (!bundle) {
    return null;
  }
  const selections = yield* Effect.forEach(
    request.selectors,
    (selector) =>
      loadPlacement(request, selector).pipe(
        Effect.map((placement) => ({ placement, selector }))
      ),
    { concurrency: "unbounded" }
  );
  if (selections.some(({ placement }) => placement === null)) {
    return null;
  }
  const foundSelections = selections.filter(
    (selection): selection is ProtectedPlacementSelection =>
      selection.placement !== null
  );
  yield* loadVerifiedSnapshot("tryout", request.snapshotId);
  const items = yield* Effect.forEach(
    foundSelections,
    ({ placement, selector }) =>
      resolveProtectedItem(request, selector, placement),
    { concurrency: "unbounded" }
  );
  return {
    bundleJson: bundle.bundleJson,
    items,
    rendererJson: bundle.rendererJson,
  };
});
