import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { createAuth } from "@repo/backend/convex/auth";

export const auth = createAuth({} as GenericCtx<DataModel>);
