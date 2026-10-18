import type { Ref } from "@confect/core";
import type access from "@repo/backend/confect/_generated/refs/access";
import type integrations from "@repo/backend/confect/_generated/refs/integrations";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr, Order } from "effect";

/** One period as the periods list shows it. */
export type Period = Ref.Returns<typeof tenancy.periods.list>["page"][number];

/** One pending invite as the invites list shows it. */
export type Invite = Ref.Returns<typeof tenancy.invites.list>["page"][number];

/** One integration client as the clients list shows it. */
export type Client = Ref.Returns<
  typeof integrations.clients.list
>["page"][number];

/** One active grant of the school, with the Person who holds it, its role and its scope. */
export type Grant = Ref.Returns<typeof access.grants.list>["page"][number];

/** One Person of the school as the people list shows them. */
export type Person = Ref.Returns<typeof tenancy.people.list>["page"][number];

/** One unit of the school with its national school number. */
export type Unit = Ref.Returns<typeof tenancy.units.list>[number];

/**
 * The start of the ID of a row that the page shows before the server answers. The
 * server never issues an ID with it, so a row with it is still on its way.
 */
export const DRAFT_PREFIX = "draft-";

/** Whether a row is one the page shows before the server answers, so its actions wait. */
export function isDraft(id: string) {
  return id.startsWith(DRAFT_PREFIX);
}

/** The periods of one page in the order the list shows them: the newest start first. */
const byNewestStart = Order.flip(
  Order.mapInput(Order.String, (period: Period) => period.start)
);

/** Sets the status of one period on a page, and keeps every other period as it is. */
export function setPeriodStatus(
  page: readonly Period[],
  periodId: Period["id"],
  status: Period["status"]
) {
  return Arr.map(page, (period) =>
    period.id === periodId ? { ...period, status } : period
  );
}

/** Sets the name of one period on a page, and keeps every other period as it is. */
export function setPeriodName(
  page: readonly Period[],
  periodId: Period["id"],
  name: Period["name"]
) {
  return Arr.map(page, (period) =>
    period.id === periodId ? { ...period, name } : period
  );
}

/** Puts a planned period on a page, in the order the list shows its periods. */
export function insertPeriod(page: readonly Period[], period: Period) {
  return Arr.sort(Arr.prepend(page, period), byNewestStart);
}

/** Takes the item with this ID off a page or a list, and keeps every other item as it is. */
export function withoutItem<Item extends { readonly id: unknown }>(
  items: readonly Item[],
  id: Item["id"]
) {
  return Arr.filter(items, (item) => item.id !== id);
}

/** Shows one client as revoked at this time, and keeps every other client as it is. */
export function revokeClient(
  page: readonly Client[],
  clientId: Client["id"],
  revokedAt: number
) {
  const revoked: Client["status"] = "revoked";
  return Arr.map(page, (client) =>
    client.id === clientId ? { ...client, revokedAt, status: revoked } : client
  );
}

/** Changes one unit of a list of units, and keeps every other unit as it is. */
export function mapUnit<Item extends { readonly id: unknown }>(
  units: readonly Item[],
  unitId: Item["id"],
  change: (unit: Item) => Item
) {
  return Arr.map(units, (unit) => (unit.id === unitId ? change(unit) : unit));
}
