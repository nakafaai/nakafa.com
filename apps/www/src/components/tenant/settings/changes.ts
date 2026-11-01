import {
  WEBHOOK_READS,
  WebhookChange,
} from "@repo/backend/confect/integrations/hook";
import { Array as Arr } from "effect";

/** One change a webhook can carry. */
type Change = typeof WebhookChange.Type;

/** The changes that a client's action list opens, in the order the list shows them. */
export const offeredChanges = (actions: readonly string[]) =>
  Arr.filter(WebhookChange.literals, (change) =>
    Arr.contains(actions, WEBHOOK_READS[change])
  );

/**
 * Checks or unchecks one change of a webhook, and returns the changes it carries in the order
 * the list shows them. A webhook keeps at least one change, so the last one stays checked.
 */
export function toggleChange(
  offered: readonly Change[],
  selected: readonly Change[],
  change: Change,
  checked: boolean
) {
  const next = Arr.filter(offered, (candidate) =>
    candidate === change ? checked : Arr.contains(selected, candidate)
  );
  return Arr.isReadonlyArrayEmpty(next) ? [...selected] : next;
}
