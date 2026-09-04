import { internalQuery } from "@repo/backend/convex/_generated/server";
import { readMaterialPublication } from "@repo/backend/convex/contentRelease/material/publication";
import { materialModelValidator } from "@repo/backend/convex/contentRelease/material/spec";
import { publicResultValidator } from "@repo/backend/convex/contentRelease/runtime/public/internal";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const materialRuntimeRowValidator = v.object({
  model: materialModelValidator,
  runtime: publicResultValidator,
});
/** Raw cohesive row returned only to the authenticated material adapter. */
export type MaterialRuntimeRow = Infer<typeof materialRuntimeRowValidator>;

/** Returns one cohesive material shell and body to the authenticated adapter. */
export const read = internalQuery({
  args: { appLocale: appLocaleValidator, publicPath: v.string() },
  returns: materialRuntimeRowValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readMaterialPublication(ctx, args.appLocale, args.publicPath)
    ),
});
