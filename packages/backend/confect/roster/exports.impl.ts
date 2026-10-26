import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import type { AuthFailure } from "@repo/backend/confect/auth/spec";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/roster/exports.spec";
import type { RosterLine } from "@repo/backend/confect/roster/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Layer } from "effect";

/**
 * How many students one read of the list holds. Each line reads its person, its class group,
 * its roster row, and the school key, so a page stays far under a query's read limit.
 */
export const EXPORT_PAGE = 100;

/** The lines of the period from `cursor` on, appended to the lines already read. */
const linesFrom = (
  args: { periodId: GenericId.GenericId<"tenantPeriods">; slug: TenantSlug },
  cursor: string | null,
  read: readonly (typeof RosterLine.Type)[]
): Effect.Effect<
  readonly (typeof RosterLine.Type)[],
  AccessDenied | AuthFailure,
  QueryRunner
> =>
  Effect.gen(function* () {
    const { runQuery } = yield* QueryRunner;
    const page = yield* runQuery(refs.public.roster.imports.list, {
      ...args,
      paginationOpts: { cursor, numItems: EXPORT_PAGE },
    }).pipe(
      Effect.catchTags({
        NotMember: () =>
          Effect.fail(
            new AccessDenied({ action: "roster.import", reason: "role" })
          ),
        SchemaError: Effect.die,
      })
    );
    const lines = Arr.appendAll(read, page.page);
    return page.isDone
      ? lines
      : yield* linesFrom(args, page.continueCursor, lines);
  });

/** Every student of the period, read a page at a time under the caller's access. */
const lines = FunctionImpl.make(
  databaseSchema,
  spec,
  "lines",
  Effect.fn("roster.exports.lines")(function* (args) {
    yield* requireAuth();
    return yield* linesFrom(args, null, []);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(lines),
  Layer.provide(session),
  GroupImpl.finalize
);
