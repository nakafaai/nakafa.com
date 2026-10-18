import { Array as Arr, Schema } from "effect";

/**
 * The actions a client of a school may hold, which the integration catalog opens
 * to a client. The catalog test checks that this list is the catalog's own.
 */
export const IntegrationAction = Schema.Literals([
  "cohort.view",
  "period.view",
  "person.view",
]);

export type IntegrationAction = typeof IntegrationAction.Type;

/**
 * Checks or unchecks one action of a client being created, and returns the actions
 * it holds in the order the list shows them. A client keeps at least one action, so
 * the last checked action cannot be unchecked, and the list stays as it was.
 */
export function toggleAction(
  selected: readonly IntegrationAction[],
  action: IntegrationAction,
  checked: boolean
) {
  const next = Arr.filter(IntegrationAction.literals, (candidate) =>
    candidate === action ? checked : Arr.contains(selected, candidate)
  );
  return next.length === 0 ? [...selected] : next;
}
