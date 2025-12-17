import { handler } from "@/lib/auth-server";

// Proxy all /v1/* requests to Convex HTTP endpoints
// Uses the Better Auth handler for routing
export const { GET, POST } = handler;
