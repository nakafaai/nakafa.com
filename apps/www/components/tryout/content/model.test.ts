import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { makeRenderedTryoutContentEntry } from "@/components/tryout/content/model";

describe("try-out rendered content entry", () => {
  it("pairs the artifact hash and body with the selector identity", () => {
    const artifactHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);

    expect(
      makeRenderedTryoutContentEntry(
        {
          contentHash: "content_1",
          sourcePath: "materials/1.mdx",
          sourceRevision: "revision_1",
        },
        artifactHash,
        "rendered artifact"
      )
    ).toEqual({
      artifactHash,
      body: "rendered artifact",
      contentHash: "content_1",
      sourcePath: "materials/1.mdx",
      sourceRevision: "revision_1",
    });
  });
});
