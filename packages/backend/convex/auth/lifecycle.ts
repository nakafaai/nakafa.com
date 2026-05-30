import { authComponent } from "@repo/backend/convex/auth/client";

/** Better Auth component trigger callbacks executed in the app data model. */
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
