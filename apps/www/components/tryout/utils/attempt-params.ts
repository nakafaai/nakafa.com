import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";

export type TryoutAttemptParams = FunctionArgs<
  typeof api.tryouts.queries.attempts.getUserTryoutAttempt
>;
