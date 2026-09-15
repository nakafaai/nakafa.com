import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** The stored account row the identity module resolves. */
export type AccountRecord = NonNullable<
  FunctionReturnType<typeof api.auth.queries.getCurrentUser>
>;

/**
 * One resolved account as product surfaces read it.
 *
 * Every field derives from the query contract, so a backend change cannot
 * drift from this projection.
 */
export interface Viewer {
  readonly email: AccountRecord["authUser"]["email"];
  readonly id: AccountRecord["appUser"]["_id"];
  readonly image:
    | AccountRecord["authUser"]["image"]
    | AccountRecord["appUser"]["image"];
  readonly name: AccountRecord["authUser"]["name"];
  readonly plan: AccountRecord["appUser"]["plan"];
  readonly role: AccountRecord["appUser"]["role"];
}

/**
 * Projects the stored account into the one snapshot surfaces read.
 *
 * Storage keeps separate app and auth rows, and a UI name, image, and email
 * come from the auth row. Projecting here keeps that layout inside the owning
 * module instead of every consumer.
 */
export function toViewer(account: AccountRecord): Viewer {
  return {
    email: account.authUser.email,
    id: account.appUser._id,
    image: account.authUser.image ?? account.appUser.image ?? null,
    name: account.authUser.name,
    plan: account.appUser.plan,
    role: account.appUser.role,
  };
}
