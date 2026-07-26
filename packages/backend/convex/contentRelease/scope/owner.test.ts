import { ContentPublicationIdentitySchema } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  testPublicationScope,
  testRendererJson,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  TEST_OWNER_CANDIDATE as CANDIDATE,
  TEST_OWNER_KEY as CONTENT_KEY,
  TEST_OWNER_SCOPE as EXACT_SCOPE,
  markOwnerVerified,
  ownerReleaseJson,
  TEST_OWNER_RECOVERY as RECOVERY,
  stageVerifiedOwner,
} from "@repo/backend/test/release-owner";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const begin = internal.contentRelease.verify.begin;
const activate = internal.contentRelease.activate.activate;
const abortRelease = internal.contentRelease.manifest.abort;
const stageRecovery = internal.contentRelease.manifest.stageRecovery;
const stageRelease = internal.contentRelease.manifest.stageRelease;

describe("contentRelease/scope/owner", () => {
  it("owns and verifies exact unchanged content without a release item", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(stageRelease, {
      releaseJson: ownerReleaseJson(CANDIDATE, { scope: EXACT_SCOPE }),
      rendererJson: testRendererJson(),
    });

    const stored = await t.run(async (ctx) => ({
      items: await ctx.db.query("contentItems").collect(),
      owners: await ctx.db.query("contentOwners").collect(),
    }));
    expect(stored.items).toHaveLength(0);
    expect(stored.owners).toMatchObject([
      {
        contentKey: CONTENT_KEY,
        managed: true,
        releaseId: CANDIDATE.releaseId,
        sequence: CANDIDATE.sequence,
      },
    ]);
    await expect(
      t.mutation(begin, { releaseId: CANDIDATE.releaseId })
    ).resolves.toBe(-1);

    const missing = convexTest(schema, convexModules);
    await missing.mutation(stageRelease, {
      releaseJson: ownerReleaseJson(CANDIDATE, { scope: EXACT_SCOPE }),
      rendererJson: testRendererJson(),
    });
    await missing.mutation(async (ctx) => {
      const owner = await ctx.db.query("contentOwners").unique();
      if (!owner) {
        throw new Error("Expected staged owner.");
      }
      await ctx.db.delete("contentOwners", owner._id);
    });
    await expect(
      missing.mutation(begin, { releaseId: CANDIDATE.releaseId })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const abandoned = convexTest(schema, convexModules);
    await abandoned.mutation(stageRelease, {
      releaseJson: ownerReleaseJson(CANDIDATE, { scope: EXACT_SCOPE }),
      rendererJson: testRendererJson(),
    });
    await expect(
      abandoned.mutation(abortRelease, { releaseId: CANDIDATE.releaseId })
    ).resolves.toMatchObject({ complete: true, totalItems: 0 });
    await expect(
      abandoned.run((ctx) => ctx.db.query("contentOwners").collect())
    ).resolves.toEqual([]);
  });

  it("restores absent and previously managed exact ownership", async () => {
    const absent = convexTest(schema, convexModules);
    await stageVerifiedOwner(
      absent,
      CANDIDATE,
      ownerReleaseJson(CANDIDATE, { scope: EXACT_SCOPE })
    );
    await absent.mutation(stageRecovery, {
      releaseJson: ownerReleaseJson(RECOVERY, {
        base: CANDIDATE,
        originReleaseId: CANDIDATE.releaseId,
        scope: EXACT_SCOPE,
      }),
      rendererJson: testRendererJson(),
    });
    const absentOwners = await absent.run((ctx) =>
      ctx.db.query("contentOwners").withIndex("by_sequence").collect()
    );
    expect(absentOwners.map(({ managed }) => managed)).toEqual([true, false]);

    const managed = convexTest(schema, convexModules);
    const base = {
      manifestHash: `sha256:${"3".repeat(64)}`,
      releaseId: "release-owner-base",
      sequence: 1,
    } satisfies TestIdentity;
    const forward = { ...CANDIDATE, sequence: 2 };
    const inverse = { ...RECOVERY, sequence: 3 };
    await managed.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...base,
        ownership: { base: [], result: [] },
        role: "candidate",
        scope: EXACT_SCOPE,
        status: "completed",
      });
      await insertTestState(ctx, {
        active: base,
        nextSequence: 2,
      });
      await ctx.db.insert("contentOwners", {
        contentKey: CONTENT_KEY,
        family: "material",
        locale: "en",
        managed: true,
        releaseId: base.releaseId,
        sequence: base.sequence,
      });
    });
    await stageVerifiedOwner(
      managed,
      forward,
      ownerReleaseJson(forward, { base, scope: EXACT_SCOPE })
    );
    await managed.mutation(stageRecovery, {
      releaseJson: ownerReleaseJson(inverse, {
        base: forward,
        originReleaseId: forward.releaseId,
        scope: EXACT_SCOPE,
      }),
      rendererJson: testRendererJson(),
    });
    const managedOwners = await managed.run((ctx) =>
      ctx.db.query("contentOwners").withIndex("by_sequence").collect()
    );
    expect(managedOwners.map(({ managed: value }) => value)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("keeps recovery validation immutable after candidate activation", async () => {
    const t = convexTest(schema, convexModules);
    await stageVerifiedOwner(
      t,
      CANDIDATE,
      ownerReleaseJson(CANDIDATE, { scope: EXACT_SCOPE })
    );
    const input = {
      releaseJson: ownerReleaseJson(RECOVERY, {
        base: CANDIDATE,
        originReleaseId: CANDIDATE.releaseId,
        scope: EXACT_SCOPE,
      }),
      rendererJson: testRendererJson(),
    };
    await t.mutation(stageRecovery, input);
    await markOwnerVerified(t, RECOVERY.releaseId);
    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });

    await expect(t.mutation(stageRecovery, input)).resolves.toMatchObject({
      phase: "verified",
      releaseId: RECOVERY.releaseId,
    });
  });

  it("derives a forward rollback from its immutable origin base", async () => {
    const t = convexTest(schema, convexModules);
    const base = {
      manifestHash: `sha256:${"3".repeat(64)}`,
      releaseId: "release-family-origin",
      sequence: 1,
    } satisfies TestIdentity;
    const rollback = {
      manifestHash: `sha256:${"4".repeat(64)}`,
      releaseId: "release-family-rollback",
      sequence: 2,
    } satisfies TestIdentity;
    const scope = testPublicationScope({ families: ["material"] });
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...base,
        ownership: { base: [], result: ["material"] },
        role: "candidate",
        scope,
        status: "completed",
      });
      await insertTestState(ctx, {
        active: base,
        nextSequence: rollback.sequence,
      });
    });
    await t.mutation(stageRelease, {
      releaseJson: ownerReleaseJson(rollback, {
        base,
        originReleaseId: base.releaseId,
        scope,
      }),
      rendererJson: testRendererJson(),
    });

    const release = await t.run((ctx) =>
      ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (query) =>
          query.eq("releaseId", rollback.releaseId)
        )
        .unique()
    );
    expect(release).toMatchObject({
      baseFamilies: ["material"],
      resultFamilies: [],
      role: "candidate",
    });
  });

  it("rejects a rollback that changes its immutable origin scope", async () => {
    const t = convexTest(schema, convexModules);
    await stageVerifiedOwner(
      t,
      CANDIDATE,
      ownerReleaseJson(CANDIDATE, { scope: EXACT_SCOPE })
    );
    const changedKey = ContentKeySchema.make("test:owner-changed");

    await expect(
      t.mutation(stageRecovery, {
        releaseJson: ownerReleaseJson(RECOVERY, {
          base: CANDIDATE,
          originReleaseId: CANDIDATE.releaseId,
          scope: testPublicationScope({
            content: [
              {
                contentKey: changedKey,
                family: "material",
                locale: "en",
              },
            ],
            families: [],
          }),
        }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("rejects conflicting rows and oversized exact scopes", async () => {
    const conflict = convexTest(schema, convexModules);
    await conflict.mutation((ctx) =>
      ctx.db.insert("contentOwners", {
        contentKey: CONTENT_KEY,
        family: "material",
        locale: "en",
        managed: true,
        releaseId: CANDIDATE.releaseId,
        sequence: CANDIDATE.sequence,
      })
    );
    await expect(
      conflict.mutation(stageRelease, {
        releaseJson: ownerReleaseJson(CANDIDATE, { scope: EXACT_SCOPE }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });

    const content = Array.from({ length: 65 }, (_, index) =>
      ContentPublicationIdentitySchema.make({
        contentKey: ContentKeySchema.make(
          `test:owner-${index.toString().padStart(2, "0")}`
        ),
        family: "material",
        locale: "en",
      })
    );
    const limited = convexTest(schema, convexModules);
    await expect(
      limited.mutation(stageRelease, {
        releaseJson: ownerReleaseJson(CANDIDATE, {
          scope: testPublicationScope({ content, families: [] }),
        }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
