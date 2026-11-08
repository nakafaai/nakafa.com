import type { Ref } from "@confect/core";
import { PublicContentRuntimeFoundSchema } from "@nakafa/aksara-contracts/runtime/spec";
import refs from "@repo/backend/confect/_generated/refs";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

const decodeJson = Schema.decodeEffect(JsonTextSchema);

/**
 * Composes the public response that a reader rebuilds from one body's parts (the
 * release frame, the body's head, its artifact and its projection) and decodes it
 * strictly, so a test proves the parts still make one signed found response.
 */
export const composeTestDelivery = Effect.fn("TestContent.composeDelivery")(
  function* (
    frame: NonNullable<
      Ref.Returns<typeof refs.public.contentRelease.runtime.active.frame>
    >,
    head: NonNullable<
      Ref.Returns<typeof refs.public.contentRelease.material.lesson>["delivery"]
    >,
    artifactJson: string,
    projectionJson: string
  ) {
    return yield* Schema.decodeUnknownEffect(PublicContentRuntimeFoundSchema)(
      {
        activeManifestHash: frame.activeManifestHash,
        activeReleaseId: frame.activeReleaseId,
        artifact: yield* decodeJson(artifactJson),
        delivery: "public",
        kind: "found",
        projection: yield* decodeJson(projectionJson),
        projectionHash: head.projectionHash,
        release: yield* decodeJson(frame.releaseJson),
        rendererManifest: yield* decodeJson(frame.rendererJson),
        sourcePath: head.sourcePath,
      },
      { onExcessProperty: "error" }
    );
  }
);
