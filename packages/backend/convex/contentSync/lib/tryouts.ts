import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { TryoutPartKey } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";

interface SyncedTryoutPart {
  partKey: TryoutPartKey;
  setId: Id<"exerciseSets">;
}

/** Load the persisted part-set mappings for one tryout within the expected bound. */
async function loadTryoutPartSetMappings(
  ctx: MutationCtx,
  {
    expectedPartCount,
    parts,
    tryoutId,
  }: {
    expectedPartCount: number;
    parts: SyncedTryoutPart[];
    tryoutId: Id<"tryouts">;
  }
) {
  const existingMappings = await ctx.db
    .query("tryoutPartSets")
    .withIndex("by_tryoutId_and_partIndex", (q) => q.eq("tryoutId", tryoutId))
    .take(expectedPartCount + 1);

  if (existingMappings.length > expectedPartCount) {
    throw new ConvexError({
      code: "TRYOUT_PART_SET_COUNT_EXCEEDED",
      message: "Tryout part set mapping count exceeds detected tryout parts.",
    });
  }

  const mappingsByPartIndex = new Map<number, Doc<"tryoutPartSets">>();

  for (const mapping of existingMappings) {
    if (!parts[mapping.partIndex]) {
      continue;
    }

    if (mappingsByPartIndex.has(mapping.partIndex)) {
      throw new ConvexError({
        code: "TRYOUT_PART_SET_DUPLICATE_INDEX",
        message: "Tryout part set mappings contain duplicate part indexes.",
      });
    }

    mappingsByPartIndex.set(mapping.partIndex, mapping);
  }

  return { existingMappings, mappingsByPartIndex };
}

/** Apply the exact detected part-set mapping shape for one tryout. */
async function applyTryoutPartSetMappings(
  ctx: MutationCtx,
  {
    existingMappings,
    mappingsByPartIndex,
    parts,
    tryoutId,
  }: {
    existingMappings: Doc<"tryoutPartSets">[];
    mappingsByPartIndex: Map<number, Doc<"tryoutPartSets">>;
    parts: SyncedTryoutPart[];
    tryoutId: Id<"tryouts">;
  }
) {
  for (const [partIndex, part] of parts.entries()) {
    const existingMapping = mappingsByPartIndex.get(partIndex);

    if (!existingMapping) {
      await ctx.db.insert("tryoutPartSets", {
        partIndex,
        partKey: part.partKey,
        setId: part.setId,
        tryoutId,
      });
      continue;
    }

    if (
      existingMapping.partKey === part.partKey &&
      existingMapping.setId === part.setId
    ) {
      continue;
    }

    await ctx.db.patch("tryoutPartSets", existingMapping._id, {
      partKey: part.partKey,
      setId: part.setId,
    });
  }

  const validPartIndexes = new Set(parts.map((_, partIndex) => partIndex));

  for (const existingMapping of existingMappings) {
    if (validPartIndexes.has(existingMapping.partIndex)) {
      continue;
    }

    await ctx.db.delete("tryoutPartSets", existingMapping._id);
  }
}

/** Sync the persisted part-set mapping rows for one detected tryout. */
export async function syncTryoutPartSetMappings(
  ctx: MutationCtx,
  {
    parts,
    tryoutId,
  }: {
    parts: SyncedTryoutPart[];
    tryoutId: Id<"tryouts">;
  }
) {
  const tryout = await ctx.db.get("tryouts", tryoutId);
  const expectedPartCount = Math.max(parts.length, tryout?.partCount ?? 0);
  const { existingMappings, mappingsByPartIndex } =
    await loadTryoutPartSetMappings(ctx, {
      expectedPartCount,
      parts,
      tryoutId,
    });

  const hasChanges =
    existingMappings.length !== parts.length ||
    existingMappings.some(
      (mapping) =>
        parts[mapping.partIndex]?.setId !== mapping.setId ||
        parts[mapping.partIndex]?.partKey !== mapping.partKey
    );

  if (!hasChanges) {
    return false;
  }

  await applyTryoutPartSetMappings(ctx, {
    existingMappings,
    mappingsByPartIndex,
    parts,
    tryoutId,
  });

  return true;
}
