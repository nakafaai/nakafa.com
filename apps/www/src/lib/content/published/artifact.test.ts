// @vitest-environment node

// Node tests isolate Next navigation imports while real semantic renderers execute.
import { describe, expect, it } from "@effect/vitest";
import { testSignedArtifact } from "@repo/backend/test/content/proof";
import { Effect } from "effect";
import { renderVerifiedArtifact } from "@/lib/content/published/artifact";

describe("authenticated artifact rendering", () => {
  it.effect(
    "fails with the renderer's missing implementation for a component the artifact requires",
    () =>
      Effect.gen(function* () {
        const artifact = yield* testSignedArtifact("site", {
          requiredComponents: ["NoSuchComponent"],
        });
        const failure = yield* renderVerifiedArtifact({ artifact }).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "RendererImplementationMissing",
          componentName: "NoSuchComponent",
          contentKey: artifact.payload.contentKey,
          rendererDomain: "site",
        });
      })
  );
});
