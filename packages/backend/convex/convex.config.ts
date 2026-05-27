import aggregate from "@convex-dev/aggregate/convex.config.js";
import betterAuth from "@convex-dev/better-auth/convex.config";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import posthog from "@posthog/convex/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(workflow);
app.use(workpool, { name: "irtCalibrationSyncWorkpool" });
app.use(workpool, { name: "irtScalePublicationQueueWorkpool" });
app.use(workpool, { name: "tryoutLeaderboardWorkpool" });
app.use(resend);
app.use(posthog);

// Aggregates for tryout leaderboard rankings
app.use(aggregate, { name: "tryoutLeaderboard" });
app.use(aggregate, { name: "globalLeaderboard" });
app.use(aggregate, { name: "forumPostsBySequence" });
app.use(aggregate, { name: "forumPostsByAuthorSequence" });

export default app;
