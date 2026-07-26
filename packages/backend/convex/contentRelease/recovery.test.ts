import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const CANDIDATE = {
  manifestHash: `sha256:${"3".repeat(64)}`,
  releaseId: "release-recovery-base",
  sequence: 1,
} satisfies TestIdentity;
const RECOVERY = {
  manifestHash: `sha256:${"4".repeat(64)}`,
  releaseId: "release-recovery-lookup",
  sequence: 2,
} satisfies TestIdentity;
const lookup = internal.contentRelease.recovery.lookup;

describe("contentRelease/recovery", () => {
  it("returns missing for absent and noncompleted recovery", async () => {
    const absent = convexTest(schema, convexModules);
    await expect(
      absent.query(lookup, {
        recoveryId: RECOVERY.releaseId,
        releaseId: CANDIDATE.releaseId,
      })
    ).resolves.toEqual({ kind: "missing" });

    const retained = convexTest(schema, convexModules);
    await retained.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...RECOVERY,
        base: CANDIDATE,
        originReleaseId: CANDIDATE.releaseId,
        ownership: {
          base: ContentFamilySchema.literals,
          result: [],
        },
        role: "recovery",
        status: "verified",
      });
    });
    await expect(
      retained.query(lookup, {
        recoveryId: RECOVERY.releaseId,
        releaseId: CANDIDATE.releaseId,
      })
    ).resolves.toEqual({ kind: "missing" });
  });

  it("returns exact completed recovery after later state advancement", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...CANDIDATE,
        ownership: {
          base: [],
          result: ContentFamilySchema.literals,
        },
        role: "candidate",
        status: "completed",
      });
      await insertZeroRelease(ctx, {
        ...RECOVERY,
        base: CANDIDATE,
        originReleaseId: CANDIDATE.releaseId,
        ownership: {
          base: ContentFamilySchema.literals,
          result: [],
        },
        role: "recovery",
        status: "completed",
      });
    });

    const result = await t.query(lookup, {
      recoveryId: RECOVERY.releaseId,
      releaseId: CANDIDATE.releaseId,
    });

    expect(result).toMatchObject({
      kind: "completed",
      value: { receipt: { releaseId: RECOVERY.releaseId } },
    });
  });

  it("rejects a completed recovery with unrelated rollback provenance", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...CANDIDATE,
        ownership: {
          base: [],
          result: ContentFamilySchema.literals,
        },
        role: "candidate",
        status: "completed",
      });
      await insertZeroRelease(ctx, {
        ...RECOVERY,
        base: CANDIDATE,
        originReleaseId: "release-other",
        ownership: {
          base: ContentFamilySchema.literals,
          result: [],
        },
        role: "recovery",
        status: "completed",
      });
    });

    await expect(
      t.query(lookup, {
        recoveryId: RECOVERY.releaseId,
        releaseId: CANDIDATE.releaseId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
