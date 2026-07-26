import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadState } from "@repo/backend/convex/contentRelease/model";
import { hasExactFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import {
  deriveOwnership,
  type OwnerVersion,
  type ReleaseOwnership,
} from "@repo/backend/convex/contentRelease/scope/history";
import { contentFamilyValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const MIGRATION_RELEASE_LIMIT = 100;
const MIGRATION_OWNER_LIMIT = 1000;

const migrationResultValidator = v.object({
  activeFamilies: v.array(contentFamilyValidator),
  insertedOwners: v.number(),
  ownerCount: v.number(),
  pendingOwners: v.number(),
  pendingReleases: v.number(),
  recoveryFamilies: v.optional(v.array(contentFamilyValidator)),
  releaseCount: v.number(),
  updatedReleases: v.number(),
});

/** Returns one stable key for comparing exact migration owner versions. */
function ownerIdentity(owner: OwnerVersion | Doc<"contentOwners">) {
  return `${owner.releaseId}\0${owner.contentKey}\0${owner.locale}`;
}

/** Checks stored owner rows and inserts only missing exact versions. */
const reconcileOwners = Effect.fn("contentRelease.reconcileOwners")(function* (
  ctx: MutationCtx,
  expected: readonly OwnerVersion[],
  apply: boolean,
  expectedOwners: number
) {
  if (
    !Number.isSafeInteger(expectedOwners) ||
    expectedOwners < 0 ||
    expectedOwners > MIGRATION_OWNER_LIMIT ||
    expected.length !== expectedOwners
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Ownership migration expected ${expectedOwners} owner rows and derived ${expected.length}.`
    );
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentOwners")
      .withIndex("by_sequence")
      .take(MIGRATION_OWNER_LIMIT + 1)
  );
  const expectedByIdentity = new Map(
    expected.map((owner) => [ownerIdentity(owner), owner])
  );
  const storedIdentities = new Set<string>();
  for (const owner of stored) {
    const identity = ownerIdentity(owner);
    const derived = expectedByIdentity.get(identity);
    if (
      storedIdentities.has(identity) ||
      !derived ||
      owner.family !== derived.family ||
      owner.managed !== derived.managed ||
      owner.sequence !== derived.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Ownership migration found conflicting exact-content state."
      );
    }
    storedIdentities.add(identity);
  }
  const missing = expected.filter(
    (owner) => !storedIdentities.has(ownerIdentity(owner))
  );
  if (apply) {
    for (const owner of missing) {
      yield* Effect.promise(() => ctx.db.insert("contentOwners", owner));
    }
  }
  return {
    inserted: apply ? missing.length : 0,
    pending: missing.length,
  };
});

/** Checks and optionally writes immutable family ownership on every release. */
const reconcileReleaseFamilies = Effect.fn(
  "contentRelease.reconcileReleaseFamilies"
)(function* (
  ctx: MutationCtx,
  releases: readonly Doc<"contentReleases">[],
  history: ReadonlyMap<string, ReleaseOwnership>,
  apply: boolean
) {
  let updated = 0;
  for (const release of releases) {
    const ownership = history.get(release.releaseId);
    if (!ownership) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${release.releaseId} lost its derived ownership.`
      );
    }
    const hasBase = release.baseFamilies !== undefined;
    const hasResult = release.resultFamilies !== undefined;
    if (hasBase !== hasResult) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Release ${release.releaseId} has partial family ownership.`
      );
    }
    if (hasBase && hasResult) {
      if (
        !(
          hasExactFamilies(
            release.baseFamilies ?? [],
            ownership.base.families
          ) &&
          hasExactFamilies(
            release.resultFamilies ?? [],
            ownership.result.families
          )
        )
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Release ${release.releaseId} has conflicting family ownership.`
        );
      }
      continue;
    }
    updated += 1;
    if (apply) {
      yield* Effect.promise(() =>
        ctx.db.patch("contentReleases", release._id, {
          baseFamilies: ownership.base.families,
          resultFamilies: ownership.result.families,
          updatedAt: Date.now(),
        })
      );
    }
  }
  return {
    pending: updated,
    updated: apply ? updated : 0,
  };
});

/** Derives and optionally applies explicit immutable publication ownership. */
const migrateProgram = Effect.fn("contentRelease.migrateOwnership")(function* (
  ctx: MutationCtx,
  apply: boolean,
  expectedReleases: number,
  expectedOwners: number
) {
  const state = yield* loadState(ctx);
  const releases = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_sequence")
      .order("asc")
      .take(MIGRATION_RELEASE_LIMIT + 1)
  );
  if (
    releases.length > MIGRATION_RELEASE_LIMIT ||
    releases.length !== expectedReleases
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Ownership migration expected ${expectedReleases} releases and found ${releases.length}.`
    );
  }
  if (!state && releases.length > 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Ownership migration found releases without publication state."
    );
  }
  if (state?.compactPhase !== undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Ownership migration cannot run during release compaction."
    );
  }
  const derived = yield* deriveOwnership(releases);
  const empty: ReleaseOwnership = {
    base: { content: new Map(), families: [] },
    result: { content: new Map(), families: [] },
  };
  const active = state?.activeReleaseId
    ? derived.history.get(state.activeReleaseId)
    : empty;
  const candidate = state?.candidateReleaseId
    ? derived.history.get(state.candidateReleaseId)
    : undefined;
  const recovery = state?.recoveryReleaseId
    ? derived.history.get(state.recoveryReleaseId)
    : undefined;
  if (
    !active ||
    (state?.candidateReleaseId && !candidate) ||
    (state?.recoveryReleaseId && !recovery)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Ownership migration found a slot outside release history."
    );
  }
  const owners = yield* reconcileOwners(
    ctx,
    derived.owners,
    apply,
    expectedOwners
  );
  const familyReleases = yield* reconcileReleaseFamilies(
    ctx,
    releases,
    derived.history,
    apply
  );
  return {
    activeFamilies: active.result.families,
    insertedOwners: owners.inserted,
    ownerCount: derived.owners.length,
    pendingOwners: owners.pending,
    pendingReleases: familyReleases.pending,
    recoveryFamilies: recovery?.result.families,
    releaseCount: releases.length,
    updatedReleases: familyReleases.updated,
  };
});

/** Temporarily migrates explicit ownership before schema narrowing. */
export const migrateOwnership = internalMutation({
  args: {
    apply: v.boolean(),
    expectedOwners: v.number(),
    expectedReleases: v.number(),
  },
  returns: migrationResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      migrateProgram(
        ctx,
        args.apply,
        args.expectedReleases,
        args.expectedOwners
      )
    ),
});
