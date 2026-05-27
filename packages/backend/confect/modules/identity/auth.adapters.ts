import { authComponent } from "@repo/backend/confect/modules/identity/auth.client";

/** Better Auth create/update/delete trigger functions exposed through Confect plain Convex integration. */
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
