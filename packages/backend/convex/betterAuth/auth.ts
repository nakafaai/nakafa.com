import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { createAuth } from "@repo/backend/convex/auth";

// Better Auth local-install schema generation requires a static auth export.
// The CLI loads this file outside a real Convex request context.
export const auth = createAuth({} as GenericCtx<DataModel>);
