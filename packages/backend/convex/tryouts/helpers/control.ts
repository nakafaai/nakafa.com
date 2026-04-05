import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

type TryoutControlDb = Pick<MutationCtx, "db">["db"];

const USER_TRYOUT_CONTROL_DUPLICATE_BATCH_SIZE = 100;
const USER_TRYOUT_CONTROL_RUNTIME_CHECK_SIZE = 2;

/** Loads one bounded batch of control rows for a single user. */
async function listUserTryoutControlBatch(
  db: TryoutControlDb,
  userId: Id<"users">
) {
  return await db
    .query("userTryoutControls")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(USER_TRYOUT_CONTROL_DUPLICATE_BATCH_SIZE + 1);
}

/** Loads the minimum runtime batch needed to validate the control-row invariant. */
async function listUserTryoutControlRuntimeBatch(
  db: TryoutControlDb,
  userId: Id<"users">
) {
  return await db
    .query("userTryoutControls")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(USER_TRYOUT_CONTROL_RUNTIME_CHECK_SIZE);
}

/** Inserts the steady-state owner row for one user's tryout operations. */
export async function createUserTryoutControl(
  db: TryoutControlDb,
  {
    updatedAt,
    userId,
  }: {
    updatedAt: number;
    userId: Id<"users">;
  }
) {
  return await db.insert("userTryoutControls", {
    userId,
    updatedAt,
  });
}

/**
 * Loads the dedicated owner row that serializes one user's tryout operations.
 *
 * Runtime paths require exactly one control row. Missing or duplicate rows are
 * integrity failures that must be fixed through the bounded repair path.
 */
export async function requireUserTryoutControl(
  db: TryoutControlDb,
  userId: Id<"users">
) {
  const controls = await listUserTryoutControlRuntimeBatch(db, userId);

  if (controls.length === 1) {
    return controls[0];
  }

  if (controls.length === 0) {
    throw new ConvexError({
      code: "INVALID_TRYOUT_STATE",
      message: "Tryout control is missing for this user.",
    });
  }

  throw new ConvexError({
    code: "INVALID_TRYOUT_STATE",
    message: "Tryout control is duplicated for this user.",
  });
}

/**
 * Repairs one user's dedicated control row.
 *
 * This keeps the oldest control row, deletes one bounded batch of duplicates,
 * and creates the row if it is missing.
 */
export async function repairUserTryoutControl(
  db: TryoutControlDb,
  {
    updatedAt,
    userId,
  }: {
    updatedAt: number;
    userId: Id<"users">;
  }
) {
  const user = await db.get("users", userId);

  if (!user) {
    return {
      controlId: null,
      controlsCreated: 0,
      duplicatesDeleted: 0,
      hasMoreDuplicates: false,
    };
  }

  let controls = await listUserTryoutControlBatch(db, userId);
  let primaryControl: Doc<"userTryoutControls"> | null = controls[0] ?? null;
  let controlsCreated = 0;
  let duplicatesDeleted = 0;

  if (!primaryControl) {
    const controlId = await createUserTryoutControl(db, {
      updatedAt,
      userId,
    });

    primaryControl = await db.get("userTryoutControls", controlId);
    controlsCreated = 1;
    controls = primaryControl ? [primaryControl] : [];
  }

  for (const duplicateControl of controls.slice(1)) {
    await db.delete("userTryoutControls", duplicateControl._id);
    duplicatesDeleted += 1;
  }

  return {
    controlId: primaryControl?._id ?? null,
    controlsCreated,
    duplicatesDeleted,
    hasMoreDuplicates:
      controls.length > USER_TRYOUT_CONTROL_DUPLICATE_BATCH_SIZE,
  };
}

/**
 * Records one serialized tryout-state touch on the user's dedicated control row.
 */
export async function touchUserTryoutControl(
  db: TryoutControlDb,
  {
    updatedAt,
    userId,
  }: {
    updatedAt: number;
    userId: Id<"users">;
  }
) {
  const control = await requireUserTryoutControl(db, userId);

  await db.patch("userTryoutControls", control._id, {
    updatedAt,
  });

  return control;
}
