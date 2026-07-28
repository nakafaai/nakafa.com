import aggregate from "@convex-dev/aggregate/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import posthog from "@posthog/convex/convex.config.js";
import betterAuth from "@repo/backend/convex/betterAuth/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  // Convex component env is declared here, not in `packages/backend/keys.ts`,
  // so Convex can validate and forward deployment env to @posthog/convex v2.
  // https://github.com/PostHog/posthog-js/tree/main/packages/convex#-migrating-from-v1
  // https://docs.convex.dev/components/authoring#environment-variables
  env: {
    AKSARA_PUBLICATION_TOKEN: v.string(),
    CONTENT_RUNTIME_TOKEN: v.string(),
    // Dedicated least-privilege key for permanent account erasure.
    POSTHOG_ACCOUNT_DELETION_API_KEY: v.string(),
    POSTHOG_HOST: v.string(),
    POSTHOG_PROJECT_ID: v.string(),
    POSTHOG_PROJECT_TOKEN: v.string(),
  },
});
app.use(betterAuth);
app.use(workflow);
app.use(workpool, { name: "irtCalibrationSyncWorkpool" });
app.use(workpool, { name: "irtScalePublicationQueueWorkpool" });
app.use(workpool, { name: "tryoutLeaderboardWorkpool" });
app.use(resend);
app.use(posthog, {
  env: {
    POSTHOG_HOST: app.env.POSTHOG_HOST,
    POSTHOG_PROJECT_TOKEN: app.env.POSTHOG_PROJECT_TOKEN,
  },
});

// Aggregates for tryout leaderboard rankings
app.use(aggregate, { name: "tryoutLeaderboard" });
app.use(aggregate, { name: "globalLeaderboard" });
app.use(aggregate, { name: "forumPostsBySequence" });
app.use(aggregate, { name: "forumPostsByAuthorSequence" });
app.use(aggregate, { name: "learningPopularityRankings" });

export default app;
