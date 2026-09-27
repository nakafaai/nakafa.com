import { componentsGeneric } from "convex/server";

export type Components = {
  "agentRateLimiter": import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"agentRateLimiter">;
  "betterAuth": import("@repo/backend/components/betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  "forumPostsByAuthorSequence": import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"forumPostsByAuthorSequence">;
  "forumPostsBySequence": import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"forumPostsBySequence">;
  "globalLeaderboard": import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"globalLeaderboard">;
  "learningPopularityRankings": import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"learningPopularityRankings">;
  "posthog": import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
  "resend": import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  "workflow": import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};

export const components: Components = componentsGeneric() as any;
