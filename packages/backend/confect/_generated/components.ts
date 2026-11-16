import { componentsGeneric } from "convex/server";

export type Components = {
  "agentRateLimiter": import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"agentRateLimiter">;
  "auth": import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  "authGoogle": import("@convex-dev/auth/components/google/_generated/component.js").ComponentApi<"authGoogle">;
  "authPassword": import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  "authUsername": import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
  "globalLeaderboard": import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"globalLeaderboard">;
  "learningPopularityRankings": import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"learningPopularityRankings">;
  "nina": import("@convex-dev/agent/_generated/component.js").ComponentApi<"nina">;
  "posthog": import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
  "presence": import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  "resend": import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  "workflow": import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};

export const components: Components = componentsGeneric() as any;
