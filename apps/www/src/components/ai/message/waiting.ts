import type { NinaTurnState } from "@repo/backend/confect/nina/contract/turn";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { isToolUIPart } from "ai";
import { Array as Arr } from "effect";

/**
 * Whether a row shows Nina typing: it is the newest row of the transcript, an
 * answer that has not failed, its turn is still queued or running, and it has
 * no text, reasoning or tool step to show yet. Only the newest row can have
 * more to say, so one loader shows at a time.
 */
export function isAnswerWaiting({
  last,
  message,
  status,
}: {
  last: boolean;
  message: NinaMessage;
  status: (typeof NinaTurnState.Type)["status"] | undefined;
}) {
  if (!last || message.role !== "assistant" || message.status === "failed") {
    return false;
  }
  if (status !== "queued" && status !== "running") {
    return false;
  }
  return !Arr.some(
    message.parts,
    (part) =>
      isToolUIPart(part) ||
      ((part.type === "text" || part.type === "reasoning") &&
        part.text.trim().length > 0)
  );
}
