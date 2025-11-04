import { nextJsHandler } from "@convex-dev/better-auth/nextjs";

// Proxy all /v1/* requests to Convex HTTP endpoints
// Uses the same handler as Better Auth - simple and battle-tested
export const { GET, POST } = nextJsHandler();
