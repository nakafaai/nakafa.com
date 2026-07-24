import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const getEnvelope = makeFunctionReference<
  "query",
  { manifestHash: string; releaseId: string },
  { releaseJson: string; rendererJson: string }
>("contentRelease/envelope:get");
const getReleaseEnvelope = makeFunctionReference<
  "query",
  { releaseId: string },
  { releaseJson: string; rendererJson: string }
>("contentRelease/envelope:byRelease");

describe("content release envelope", () => {
  it("returns frozen evidence for the exact stored manifest", async () => {
    const t = convexTest(schema, convexModules);
    await t.run((ctx) => insertTestRelease(ctx));

    await expect(
      t.query(getEnvelope, {
        manifestHash: TEST_MANIFEST_HASH,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toEqual({
      releaseJson: testReleaseJson(),
      rendererJson: testRendererJson(),
    });
    await expect(
      t.query(getReleaseEnvelope, { releaseId: TEST_RELEASE_ID })
    ).resolves.toEqual({
      releaseJson: testReleaseJson(),
      rendererJson: testRendererJson(),
    });
  });

  it("rejects missing releases and mismatched manifest identities", async () => {
    const missing = convexTest(schema, convexModules);
    await expect(
      missing.query(getEnvelope, {
        manifestHash: TEST_MANIFEST_HASH,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });

    const mismatch = convexTest(schema, convexModules);
    await mismatch.run((ctx) => insertTestRelease(ctx));
    await expect(
      mismatch.query(getEnvelope, {
        manifestHash: `sha256:${"f".repeat(64)}`,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });
});
