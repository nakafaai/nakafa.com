import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { createAuth } from "@repo/backend/convex/auth";

// Export a static instance for Better Auth schema generation
export const auth = createAuth({} as GenericCtx<DataModel>);
