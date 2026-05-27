import { authComponent } from "@repo/backend/confect/modules/identity/auth.client";

/** Native Better Auth triggers registered through Confect's plain Convex function boundary. */
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
