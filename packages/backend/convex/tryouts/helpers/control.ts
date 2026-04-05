import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

type TryoutControlDb = Pick<MutationCtx, "db">["db"];

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
  const controls = await db
    .query("userTryoutControls")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(100);

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
 * Loads the steady-state owner row, repairing rare missing-owner corruption by
 * taking one OCC turn on the user document before creating the control row.
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

  await db.patch("users", userId, {
    tryoutStateUpdatedAt: updatedAt,
  });

  const repairedControl = await getUserTryoutControl(db, userId);

  if (repairedControl) {
    return repairedControl;
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
