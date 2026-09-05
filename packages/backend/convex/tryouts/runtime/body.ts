import { type Infer, v } from "convex/values";

/** Original signed bytes returned to the Node artifact verification boundary. */
export const tryoutBodyBatchValidator = v.object({
  bundleJson: v.string(),
  items: v.array(
    v.object({
      artifactJson: v.string(),
      delivery: v.union(v.literal("authenticated"), v.literal("entitled")),
      sourcePath: v.string(),
    })
  ),
  rendererJson: v.string(),
});

export type TryoutBodyBatch = Infer<typeof tryoutBodyBatchValidator>;
