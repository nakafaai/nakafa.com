import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
} from "@repo/backend/test/content-proof";
import { describe, expect, it } from "vitest";

const manifest = testEmptyManifest(ReleaseIdSchema.make("release-renderer"));

describe("content release renderer identity", () => {
  it("matches only the complete renderer identity signed by the release", () => {
    expect(hasRendererIdentity(manifest, TEST_PROOF_RENDERER)).toBe(true);
    expect(hasRendererIdentity(manifest, testProofRenderer("h1"))).toBe(false);
  });
});
