import aggregate from "@convex-dev/aggregate/convex.config.js";
import migrations from "@convex-dev/migrations/convex.config";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import betterAuth from "@repo/backend/convex/betterAuth/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(migrations);
app.use(workflow);
app.use(resend);

// Separate aggregates for all content types
// This provides:
// - Type-safe simple ID keys (no tuples)
// - Independent scaling (no cross-type contention)
// - Zero type assertions
// - Ready for trending features across all content types
app.use(aggregate, { name: "articlePopularity" });
app.use(aggregate, { name: "subjectPopularity" });
app.use(aggregate, { name: "exercisePopularity" });

export default app;
