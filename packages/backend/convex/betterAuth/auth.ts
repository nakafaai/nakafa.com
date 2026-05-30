import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { createAuth } from "@repo/backend/convex/auth/runtime";

/**
 * Static Better Auth instance for local-install schema generation.
 *
 * The Better Auth CLI loads this file outside a Convex request. The local
 * install guide requires a placeholder context for this static export, so this
 * is the only allowed auth-context assertion and it must stay out of runtime
 * request paths.
 * @see https://labs.convex.dev/better-auth/features/local-install#generate-the-schema
 */
export const auth = createAuth({} as GenericCtx<DataModel>);
