import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

type TryoutControlDb = Pick<MutationCtx, "db">["db"];

const USER_TRYOUT_CONTROL_DUPLICATE_BATCH_SIZE = 100;

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
 * Loads the owner row that serializes one user's tryout operations.
 *
 * If duplicate rows already exist for the same user, this keeps the oldest row
 * and deletes the extras so later singleton assumptions stay valid.
 */
export async function getUserTryoutControl(
  db: TryoutControlDb,
  userId: Id<"users">
) {
  const controls = await listUserTryoutControlBatch(db, userId);

  const primaryControl = controls[0] ?? null;

  if (controls.length < 2 || !primaryControl) {
    return primaryControl;
  }

  for (const duplicateControl of controls.slice(1)) {
    await db.delete("userTryoutControls", duplicateControl._id);
  }

  return primaryControl;
}

/**
 * Loads the steady-state owner row, recreating it inside the dedicated control
 * table if a historical migration or manual edit removed it.
 */
export async function loadOrCreateUserTryoutControl(
  db: TryoutControlDb,
  {
    updatedAt,
    userId,
  }: {
    updatedAt: number;
    userId: Id<"users">;
  }
) {
  const control = await getUserTryoutControl(db, userId);

  if (control) {
    return control;
  }

  const user = await db.get("users", userId);

  if (!user) {
    return null;
  }

  const controlId = await createUserTryoutControl(db, {
    updatedAt,
    userId,
  });
  const createdControl = await db.get("userTryoutControls", controlId);

  if (createdControl) {
    return createdControl;
  }

  throw new ConvexError({
    code: "INVALID_TRYOUT_STATE",
    message: "Tryout control is missing for this user.",
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
  const control = await loadOrCreateUserTryoutControl(db, {
    updatedAt,
    userId,
  });

  if (!control) {
    return null;
  }

  await db.patch("userTryoutControls", control._id, {
    updatedAt,
  });

  return control;
}
