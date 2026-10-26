import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import type { Action } from "@repo/backend/confect/access/catalog";
import { PAGE_LIMIT } from "@repo/backend/confect/integrations/api";
import type { Forbidden } from "@repo/backend/confect/integrations/reads.spec";
import {
  cohortAuthority,
  periodAuthority,
  tenantAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { UNIT_LIMIT, UnitStatus } from "@repo/backend/confect/tenancy/schema";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Number as Num, Option } from "effect";

/** The answer of a read that the client's action list does not open. */
export const FORBIDDEN: typeof Forbidden.Type = { outcome: "forbidden" };

/** Loads the client a verified token named, with its school. A token names a client that exists, so a missing one is a defect. */
export const clientRead = Effect.fn("integrations.reads.client")(function* (
  clientId: GenericId.GenericId<"integrationClients">
) {
  const reader = yield* DatabaseReader;
  const client = yield* reader
    .table("integrationClients")
    .get(clientId)
    .pipe(Effect.orDie);
  const tenant = yield* reader
    .table("tenants")
    .get(client.tenantId)
    .pipe(Effect.orDie);
  return { client, tenant };
});

/** A client and its school, the principal that every read decides for. */
type ClientRead = Effect.Success<ReturnType<typeof clientRead>>;

/** Whether the client's own action list names an action. The rule and the scope are decided per row. */
export const lists = (read: ClientRead, action: typeof Action.Type) =>
  Arr.contains(read.client.actions, action);

/** The page options of a read: the cursor it names, and a size clamped to one to `PAGE_LIMIT`. */
export const pageOptions = (
  cursor: string | null,
  numItems: number
): PaginationOptions => ({
  cursor,
  numItems: Num.clamp(numItems, { maximum: PAGE_LIMIT, minimum: 1 }),
});

/**
 * The rows of one read's answer, as the REST API and the MCP tools both return them, or the
 * caller's own refusal when the client's action list or scope does not open the read.
 */
export const pageOr = <A, E>(
  answer:
    | typeof FORBIDDEN
    | {
        readonly data: A;
        readonly next: string | null;
        readonly outcome: "page";
      },
  refusal: () => E
) =>
  answer.outcome === "page"
    ? Effect.succeed({ data: answer.data, next: answer.next })
    : Effect.fail(refusal());

/** The cursor of the next page, or null on the last one. */
export const nextOf = (page: {
  readonly continueCursor: string;
  readonly isDone: boolean;
}) => (page.isDone ? null : page.continueCursor);

/** The periods of the client's school that its scope covers, newest first in each unit. */
export const periodsFor = Effect.fn("integrations.reads.periods")(function* (
  read: ClientRead
) {
  const reader = yield* DatabaseReader;
  const units = Arr.flatten(
    yield* Effect.forEach(UnitStatus.literals, (status) =>
      reader
        .table("tenantUnits")
        .index("by_tenantId_and_status", (query) =>
          query.eq("tenantId", read.tenant._id).eq("status", status)
        )
        .take(UNIT_LIMIT)
        .pipe(Effect.orDie)
    )
  );
  const periods = Arr.flatten(
    yield* Effect.forEach(units, (unit) =>
      reader
        .table("tenantPeriods")
        .index(
          "by_unitId_and_start",
          (query) => query.eq("unitId", unit._id),
          "desc"
        )
        .take(PAGE_LIMIT)
        .pipe(Effect.orDie)
    )
  );
  return yield* Effect.filter(periods, (period) =>
    periodAuthority.allowsClient("period.view", period, read)
  );
});

/** One period of the client's school by the ID a request names, when the client may read it. */
export const periodFor = Effect.fn("integrations.reads.period")(function* (
  read: ClientRead,
  periodId: string
) {
  const ctx = yield* QueryCtx;
  const id = Option.fromNullishOr(
    ctx.db.normalizeId("tenantPeriods", periodId)
  );
  if (Option.isNone(id)) {
    return Option.none();
  }
  const period = yield* (yield* DatabaseReader)
    .table("tenantPeriods")
    .get(id.value)
    .pipe(Effect.option);
  if (Option.isNone(period)) {
    return Option.none();
  }
  const allowed = yield* periodAuthority.allowsClient(
    "period.view",
    period.value,
    read
  );
  return allowed ? period : Option.none();
});

/** Whether the client may read the people of its school: `person.view` on the school itself. */
export const readsPeople = (read: ClientRead) =>
  tenantAuthority.allowsClient("person.view", read.tenant, read);

/** Whether the client may read one cohort: `cohort.view` on the cohort, by the scope of its unit. */
export const readsCohort = (
  read: ClientRead,
  cohort: Parameters<typeof cohortAuthority.allowsClient>[1]
) => cohortAuthority.allowsClient("cohort.view", cohort, read);
