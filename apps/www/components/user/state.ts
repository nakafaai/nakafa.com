import type { Docs } from "@repo/backend/confect/_generated/docs";

type UserRole = NonNullable<Docs["users"]["role"]>;

/** Patch one immutable user projection with a display name. */
export function updateUserName<T extends { name: string }>(
  user: T,
  name: string
): T {
  return { ...user, name };
}

/** Patch one immutable app-user projection with a self-selectable role. */
export function updateUserRole<T extends { role?: UserRole }>(
  user: T,
  role: UserRole
): T {
  return { ...user, role };
}
