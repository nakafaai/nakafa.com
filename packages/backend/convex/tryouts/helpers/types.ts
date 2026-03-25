import type { MutationCtx } from "@repo/backend/convex/_generated/server";

export type TryoutMutationCtx = Pick<MutationCtx, "db" | "scheduler">;
