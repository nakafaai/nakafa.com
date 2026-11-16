import aggregate from "@convex-dev/aggregate/convex.config";
import agent from "@convex-dev/agent/convex.config";
import auth from "@convex-dev/auth/convex.config";
import authGoogle from "@convex-dev/auth/components/google/convex.config";
import authPassword from "@convex-dev/auth/components/password/convex.config";
import authUsername from "@convex-dev/auth/components/username/convex.config";
import presence from "@convex-dev/presence/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import posthog from "@posthog/convex/convex.config";
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
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
    CONTENT_READ_TOKEN: v.string(),
    [NAKAFA_API_EDGE_CONTRACT.secretEnvironment]: v.string(),
    // The Google OAuth client that the Google sign-in component exchanges codes
    // with. Convex refuses a push to a deployment that lacks them.
    GOOGLE_AUTH_CLIENT_ID: v.string(),
    GOOGLE_AUTH_CLIENT_SECRET: v.string(),
    [NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT]: v.optional(v.string()),
    [NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment]: v.string(),
    // The key of the hash that stores each login card code. Convex refuses a
    // push to a deployment that lacks it, because no card could be read there.
    LOGIN_CARD_SECRET: v.string(),
    // Dedicated least-privilege key for permanent analytics erasure.
    POSTHOG_ERASURE_API_KEY: v.string(),
    POSTHOG_HOST: v.string(),
    POSTHOG_PROJECT_ID: v.string(),
    POSTHOG_PROJECT_TOKEN: v.string(),
    // Root keys that wrap each learner's vault key and each school's key.
    // Convex refuses a push to a deployment that lacks them, because nothing
    // sealed could be read there.
    VAULT_ROOT_KEYS: v.string(),
  },
});
// Convex Auth: the core owns sessions and signs their access tokens with the
// deployment's own key, under its default name `auth`, which
// `convexAuthProvider` and `getAuthUserId` read. Google serves its callback at
// `<CONVEX_SITE_URL>/oauth/google/callback`. School accounts sign in with a
// username and a password (ADR 0009).
// https://docs.convex.dev/auth/convex-auth/getting-started
app.use(auth);
app.use(authGoogle, {
  httpPrefix: "/oauth/google",
  env: {
    CLIENT_ID: app.env.GOOGLE_AUTH_CLIENT_ID,
    CLIENT_SECRET: app.env.GOOGLE_AUTH_CLIENT_SECRET,
  },
});
app.use(authUsername);
app.use(authPassword);
app.use(agent, { name: "nina" });
app.use(presence);
app.use(rateLimiter, { name: "agentRateLimiter" });
app.use(workflow);
app.use(resend);
app.use(posthog, {
  env: {
    POSTHOG_HOST: app.env.POSTHOG_HOST,
    POSTHOG_PROJECT_TOKEN: app.env.POSTHOG_PROJECT_TOKEN,
  },
});

app.use(aggregate, { name: "globalLeaderboard" });
app.use(aggregate, { name: "learningPopularityRankings" });

export default app;
