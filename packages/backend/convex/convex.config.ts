import aggregate from "@convex-dev/aggregate/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import betterAuth from "@repo/backend/convex/betterAuth/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(workflow);
app.use(workpool, { name: "irtCalibrationSyncWorkpool" });
app.use(workpool, { name: "irtScalePublicationQueueWorkpool" });
app.use(workpool, { name: "irtScaleQualityRefreshWorkpool" });
app.use(workpool, { name: "tryoutLeaderboardWorkpool" });
app.use(resend);

// Aggregates for tryout leaderboard rankings
app.use(aggregate, { name: "tryoutLeaderboard" });
app.use(aggregate, { name: "globalLeaderboard" });

export default app;
