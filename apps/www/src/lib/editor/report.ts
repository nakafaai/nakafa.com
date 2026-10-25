import { Effect, Option } from "effect";
import { reportClientException } from "@/lib/analytics/client";
import type { SyncDropped } from "@/lib/editor/session";

/**
 * Reports the steps an editor lost, as the loop counted them, once. The teacher cannot act
 * on the loss, so it goes to error reporting and never to a toast.
 */
export const reportDropped = Effect.fn("editor.sync.reportDropped")(function* (
  dropped: Option.Option<SyncDropped>,
  source: string
) {
  if (Option.isNone(dropped)) {
    return;
  }
  yield* reportClientException(dropped.value, { source });
});
