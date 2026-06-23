import { query } from "@repo/backend/convex/_generated/server";
import {
  learningArtifactIdValidator,
  visibleLearningArtifactValidator,
} from "@repo/backend/convex/chats/artifacts/spec";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { loadVisibleArtifact } from "./read";

/** Loads a full artifact payload only after the visible manifest is opened. */
export const loadVisible = query({
  args: {
    artifactId: learningArtifactIdValidator,
  },
  returns: visibleLearningArtifactValidator,
  handler: async (ctx, args) => {
    const viewer = await getOptionalAppUser(ctx);
    return loadVisibleArtifact(
      ctx,
      args.artifactId,
      viewer?.appUser._id ?? null
    );
  },
});
