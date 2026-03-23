import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { createAuth } from "@repo/backend/convex/auth";

function createCliAuth() {
  // Better Auth local-install schema generation requires a static auth export.
  // This file is used only by the Better Auth CLI, not at runtime.
  return createAuth({} as GenericCtx<DataModel>);
}

export const auth = createCliAuth();
