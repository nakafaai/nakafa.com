// @vitest-environment node

import { assert, describe, it } from "@effect/vitest";
import { hasPlacementArtifactContracts } from "@repo/backend/convex/tryouts/migration/rows";
import { testSignedArtifact } from "@repo/backend/test/content/proof";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout/snapshot";

describe("tryouts/migration/rows", () => {
  it("binds permanent artifacts to exact question and answer roles", () => {
    const base = makeTryoutPlacementRow("en").record.row;
    const question = testSignedArtifact(base.rendererDomain, {
      artifactLocale: base.questionArtifactLocale,
      contentKey: base.questionContentKey,
    });
    const answer = testSignedArtifact(base.rendererDomain, {
      artifactLocale: base.answerArtifactLocale,
      contentKey: base.answerContentKey,
    });
    const placement = makeTryoutPlacementRow("en", {
      answerArtifactHash: answer.artifactHash,
      questionArtifactHash: question.artifactHash,
    }).record.row;

    assert.strictEqual(
      hasPlacementArtifactContracts(placement, question, answer),
      true
    );
    assert.strictEqual(
      hasPlacementArtifactContracts(placement, answer, question),
      false
    );
    assert.strictEqual(
      hasPlacementArtifactContracts(
        placement,
        question,
        testSignedArtifact(base.rendererDomain, {
          artifactLocale: "id",
          contentKey: base.answerContentKey,
        })
      ),
      false
    );
  });
});
