import type { Ref } from "@confect/core";
import type auth from "@repo/backend/confect/_generated/refs/auth";

/** The stored account row the identity module resolves. */
export type AccountRecord = NonNullable<
  Ref.Returns<typeof auth.queries.getCurrentUser>
>;

/**
 * Projects the stored account into the one snapshot surfaces read.
 *
 * The account row holds the name, image, and email that surfaces show.
 * Projecting here keeps that layout inside the owning module instead of every
 * consumer.
 */
export function toViewer(account: AccountRecord) {
  return {
    email: account.appUser.email,
    id: account.appUser._id,
    image: account.appUser.image ?? null,
    name: account.appUser.name,
    plan: account.appUser.plan,
    role: account.appUser.role,
  };
}

/**
 * One resolved account as product surfaces read it.
 *
 * Every field derives from the query contract through `toViewer`, so a backend
 * change cannot drift from this projection.
 */
export type Viewer = ReturnType<typeof toViewer>;
