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
app.use(aggregate, { name: "contentPopularity" });

export default app;
