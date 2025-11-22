import migrations from "@convex-dev/migrations/convex.config";
import workflow from "@convex-dev/workflow/convex.config.js";
import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(migrations);
app.use(workflow);

export default app;
