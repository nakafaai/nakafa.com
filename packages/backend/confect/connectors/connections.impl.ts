import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { SchoolConnection } from "@repo/backend/confect/connectors/access";
import { connectionAccess } from "@repo/backend/confect/connectors/authority";
import {
  disconnect,
  loadOwnConnection,
  view,
} from "@repo/backend/confect/connectors/connection";
import spec from "@repo/backend/confect/connectors/connections.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Array as Arr, Effect, Layer, Number as Num, Struct } from "effect";

/** The most rows one page reads. A request asks for at least one. */
const PAGE_LIMIT = 100;

/**
 * The pagination options with their page size held between one row and
 * `PAGE_LIMIT`, so every page is bounded however a request asks.
 */
const boundedPage = <Options extends { readonly numItems: number }>(
  paginationOpts: Options
) =>
  Struct.assign(paginationOpts, {
    numItems: Num.clamp(paginationOpts.numItems, {
      maximum: PAGE_LIMIT,
      minimum: 1,
    }),
  });

/**
 * The connections of the member's school, a page at a time. The school index
 * orders them by status, then newest first within each status, and bounds every
 * page.
 */
const listSchool = FunctionImpl.make(
  databaseSchema,
  spec,
  "listSchool",
  Effect.fn("connectors.connections.listSchool")(function* ({
    paginationOpts,
  }) {
    const { tenant } = yield* Member;
    const page = yield* (yield* DatabaseReader)
      .table("connectorConnections")
      .index(
        "by_tenantId_and_status",
        (query) => query.eq("owner.tenantId", tenant._id),
        "desc"
      )
      .paginate(boundedPage(paginationOpts))
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: Arr.map(page.page, view) });
  })
);

/**
 * The personal connections of the signed-in account, a page at a time, ordered by
 * status and then newest first, as the school list is. Another account's
 * connections are never read.
 */
const listOwn = FunctionImpl.make(
  databaseSchema,
  spec,
  "listOwn",
  Effect.fn("connectors.connections.listOwn")(function* ({ paginationOpts }) {
    const { appUser } = yield* requireAuth();
    const page = yield* (yield* DatabaseReader)
      .table("connectorConnections")
      .index(
        "by_userId_and_status",
        (query) => query.eq("owner.userId", appUser._id),
        "desc"
      )
      .paginate(boundedPage(paginationOpts))
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: Arr.map(page.page, view) });
  })
);

/**
 * Disconnects a school connection that the member may manage. The connection is
 * decided on its row first, so another school's connection is refused as missing.
 */
const disconnectSchool = FunctionImpl.make(
  databaseSchema,
  spec,
  "disconnectSchool",
  Effect.fn("connectors.connections.disconnectSchool")(function* () {
    const connection = yield* SchoolConnection;
    const { person } = yield* Member;
    yield* disconnect(personActor(person), connection);
    return null;
  })
);

/**
 * Disconnects a personal connection that the signed-in account owns. A connection
 * of a school or of another account is refused as missing.
 */
const disconnectOwn = FunctionImpl.make(
  databaseSchema,
  spec,
  "disconnectOwn",
  Effect.fn("connectors.connections.disconnectOwn")(function* ({
    connectionId,
  }) {
    const { appUser } = yield* requireAuth();
    const connection = yield* loadOwnConnection(appUser._id, connectionId);
    yield* disconnect({ id: appUser._id, kind: "user" }, connection);
    return null;
  })
);

/**
 * Implements the connections group of `connections.spec.ts`: two lists, and two
 * disconnects, one for a school and one for an account.
 */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(listSchool),
  Layer.provide(listOwn),
  Layer.provide(disconnectSchool),
  Layer.provide(disconnectOwn),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(connectionAccess),
  GroupImpl.finalize
);
