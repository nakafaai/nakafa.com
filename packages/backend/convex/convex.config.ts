import aggregate from "@convex-dev/aggregate/convex.config.js";
import migrations from "@convex-dev/migrations/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import posthog from "@posthog/convex/convex.config.js";
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import betterAuth from "@repo/backend/convex/betterAuth/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  // Convex component env is declared here, not in `packages/backend/keys.ts`,
  // so Convex can validate and forward deployment env to @posthog/convex v2.
  // https://github.com/PostHog/posthog-js/tree/main/packages/convex#-migrating-from-v1
  // https://docs.convex.dev/components/authoring#environment-variables
  env: {
    AKSARA_AGENT_SIGNING_KEY_ID: v.optional(v.string()),
    AKSARA_AGENT_SIGNING_PUBLIC_KEY: v.optional(v.string()),
    AKSARA_PUBLICATION_TOKEN: v.string(),
    CONTENT_RUNTIME_TOKEN: v.string(),
    [NAKAFA_API_EDGE_CONTRACT.secretEnvironment]: v.string(),
    [NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT]: v.optional(v.string()),
    [NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment]: v.string(),
    // Dedicated least-privilege key for permanent analytics erasure.
    POSTHOG_ERASURE_API_KEY: v.string(),
    POSTHOG_HOST: v.string(),
    POSTHOG_PROJECT_ID: v.string(),
    POSTHOG_PROJECT_TOKEN: v.string(),
  },
});
app.use(betterAuth);
app.use(migrations);
app.use(rateLimiter);
app.use(workflow);
app.use(resend);
app.use(posthog, {
  env: {
    POSTHOG_HOST: app.env.POSTHOG_HOST,
    POSTHOG_PROJECT_TOKEN: app.env.POSTHOG_PROJECT_TOKEN,
  },
});

app.use(aggregate, { name: "globalLeaderboard" });
app.use(aggregate, { name: "forumPostsBySequence" });
app.use(aggregate, { name: "forumPostsByAuthorSequence" });
app.use(aggregate, { name: "learningPopularityRankings" });

export default app;
