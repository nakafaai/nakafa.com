import aggregate from "@convex-dev/aggregate/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import betterAuth from "@repo/backend/convex/betterAuth/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(workflow);
app.use(resend);

// Aggregates for content popularity tracking
app.use(aggregate, { name: "articlePopularity" });
app.use(aggregate, { name: "subjectPopularity" });
app.use(aggregate, { name: "exercisePopularity" });

// Aggregates for SNBT leaderboard rankings
app.use(aggregate, { name: "tryoutLeaderboard" });
app.use(aggregate, { name: "globalLeaderboard" });

export default app;
