import type { UIMessage } from "@convex-dev/agent/react";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";

export type NinaMessage = UIMessage<typeof NinaTurnSummary.Type>;
