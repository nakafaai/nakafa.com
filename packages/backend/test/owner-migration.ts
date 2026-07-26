import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { testPublicationScope } from "@repo/backend/test/content-release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";

export const MATERIAL_KEY = ContentKeySchema.make(
  "material/lesson/mathematics/function-composition-inverse-function/function-concept"
);
const MATERIAL_SCOPE = testPublicationScope({
  content: [
    { contentKey: MATERIAL_KEY, family: "material", locale: "en" },
    { contentKey: MATERIAL_KEY, family: "material", locale: "id" },
  ],
  families: [],
});
const MATERIAL = {
  manifestHash: `sha256:${"1".repeat(64)}`,
  releaseId: "release-material",
  sequence: 1,
} satisfies TestIdentity;
const MATERIAL_RECOVERY = {
  manifestHash: `sha256:${"2".repeat(64)}`,
  releaseId: "recovery-material",
  sequence: 2,
} satisfies TestIdentity;
const MATERIAL_RESTORE = {
  manifestHash: `sha256:${"3".repeat(64)}`,
  releaseId: "restore-material",
  sequence: 3,
} satisfies TestIdentity;
const MATERIAL_RESTORE_RECOVERY = {
  manifestHash: `sha256:${"4".repeat(64)}`,
  releaseId: "restore-material-recovery",
  sequence: 4,
} satisfies TestIdentity;
const ARTICLE = {
  manifestHash: `sha256:${"5".repeat(64)}`,
  releaseId: "release-article",
  sequence: 5,
} satisfies TestIdentity;
const ARTICLE_RECOVERY = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "recovery-article",
  sequence: 6,
} satisfies TestIdentity;
export const ACTIVE = {
  manifestHash: `sha256:${"7".repeat(64)}`,
  releaseId: "restore-article",
  sequence: 7,
} satisfies TestIdentity;
export const RECOVERY = {
  manifestHash: `sha256:${"8".repeat(64)}`,
  releaseId: "restore-article-recovery",
  sequence: 8,
} satisfies TestIdentity;

/** Seeds the exact completed, aborted, and retained production topology. */
export async function seedOwnershipHistory(
  ctx: Parameters<typeof insertZeroRelease>[0]
) {
  await insertZeroRelease(ctx, {
    ...MATERIAL,
    role: "candidate",
    scope: MATERIAL_SCOPE,
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...MATERIAL_RECOVERY,
    base: MATERIAL,
    originReleaseId: MATERIAL.releaseId,
    role: "recovery",
    scope: MATERIAL_SCOPE,
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...MATERIAL_RESTORE,
    base: MATERIAL_RECOVERY,
    role: "candidate",
    scope: MATERIAL_SCOPE,
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...MATERIAL_RESTORE_RECOVERY,
    base: MATERIAL_RESTORE,
    originReleaseId: MATERIAL_RESTORE.releaseId,
    role: "recovery",
    scope: MATERIAL_SCOPE,
    status: "aborted",
  });
  await insertZeroRelease(ctx, {
    ...ARTICLE,
    base: MATERIAL_RESTORE,
    role: "candidate",
    scope: testPublicationScope({ families: ["article"] }),
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...ARTICLE_RECOVERY,
    base: ARTICLE,
    originReleaseId: ARTICLE.releaseId,
    role: "recovery",
    scope: testPublicationScope({ families: ["article"] }),
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...ACTIVE,
    base: ARTICLE_RECOVERY,
    role: "candidate",
    scope: testPublicationScope({ families: ["article"] }),
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...RECOVERY,
    base: ACTIVE,
    originReleaseId: ACTIVE.releaseId,
    role: "recovery",
    scope: testPublicationScope({ families: ["article"] }),
    status: "verified",
  });
  await ctx.db.insert("contentState", {
    activeManifestHash: ACTIVE.manifestHash,
    activeReleaseId: ACTIVE.releaseId,
    activeSequence: ACTIVE.sequence,
    key: "primary",
    nextSequence: 9,
    recoveryManifestHash: RECOVERY.manifestHash,
    recoveryReleaseId: RECOVERY.releaseId,
    recoverySequence: RECOVERY.sequence,
    updatedAt: 0,
  });
}
