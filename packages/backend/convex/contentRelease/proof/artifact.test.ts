// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyArtifactBatch } from "@repo/backend/convex/contentRelease/proof/artifact";
import {
  ingressArtifact,
  ingressItem,
  ingressReleaseId,
} from "@repo/backend/test/content/ingress";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testSignedArtifact,
} from "@repo/backend/test/content/proof";
import { testDeleteJson } from "@repo/backend/test/content/release";
import { Effect } from "effect";

describe("authenticated artifact proof batches", () => {
  it.effect(
    "counts only authenticated artifacts bound to their staged item",
    () =>
      Effect.gen(function* () {
        expect(
          yield* verifyArtifactBatch(
            [
              {
                artifactJson: JSON.stringify(ingressArtifact),
                index: 0,
                itemJson: JSON.stringify(ingressItem),
              },
            ],
            ingressReleaseId,
            TEST_PROOF_RENDERER
          )
        ).toBe(1);
      }).pipe(
        Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
      )
  );

  it.effect("rejects a deletion inserted into an artifact proof batch", () =>
    Effect.gen(function* () {
      expect(
        yield* verifyArtifactBatch(
          [
            {
              artifactJson: JSON.stringify(ingressArtifact),
              index: 0,
              itemJson: testDeleteJson(),
            },
          ],
          ingressReleaseId,
          TEST_PROOF_RENDERER
        ).pipe(Effect.flip)
      ).toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("entered an artifact batch"),
      });
    }).pipe(
      Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
    )
  );

  it.effect(
    "rejects a genuine signature when the artifact belongs to another item",
    () =>
      Effect.gen(function* () {
        const artifact = testSignedArtifact("mathematics", {
          contentKey: "test:another",
        });
        expect(
          yield* verifyArtifactBatch(
            [
              {
                artifactJson: JSON.stringify(artifact),
                index: 0,
                itemJson: JSON.stringify(ingressItem),
              },
            ],
            ingressReleaseId,
            TEST_PROOF_RENDERER
          ).pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("does not match its item"),
        });
      }).pipe(
        Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
      )
  );
});
