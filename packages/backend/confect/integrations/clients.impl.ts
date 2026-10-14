import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { Integration } from "@repo/backend/confect/integrations/access";
import { integrationAccess } from "@repo/backend/confect/integrations/authority";
import {
  authorizeScope,
  register,
  requireOpenActions,
  revokeClient,
  rotateSecret,
  view,
} from "@repo/backend/confect/integrations/client";
import spec from "@repo/backend/confect/integrations/clients.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Array as Arr, Effect, Layer, Number as Num, Struct } from "effect";

/** The largest page one request reads. */
const PAGE_LIMIT = 100;

/**
 * The clients of the member's school, newest first, a page at a time, read on
 * the school index. A school holds few clients, and every page is bounded.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("integrations.clients.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const page = yield* (yield* DatabaseReader)
      .table("integrationClients")
      .index("by_tenantId", (query) => query.eq("tenantId", tenant._id), "desc")
      .paginate(
        Struct.assign(paginationOpts, {
          numItems: Num.min(paginationOpts.numItems, PAGE_LIMIT),
        })
      )
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: Arr.map(page.page, view) });
  })
);

/**
 * Registers a client. The scope is decided first, then the action list, and
 * only then is a secret drawn and returned once.
 */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("integrations.clients.create")(function* ({
    actions,
    name,
    scope,
  }) {
    const { person, tenant } = yield* Member;
    yield* authorizeScope(scope);
    yield* requireOpenActions(actions);
    return yield* register(personActor(person), tenant._id, {
      actions,
      name,
      scope,
    });
  })
);

/** Draws a new secret for an active client. The Integration middleware refuses a revoked one. */
const rotate = FunctionImpl.make(
  databaseSchema,
  spec,
  "rotate",
  Effect.fn("integrations.clients.rotate")(function* () {
    const { person } = yield* Member;
    return yield* rotateSecret(personActor(person), yield* Integration);
  })
);

/**
 * Revokes an active client. A client already revoked stays revoked, so a
 * retried request succeeds, as an ended grant does.
 */
const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("integrations.clients.revoke")(function* () {
    const client = yield* Integration;
    if (client.status === "revoked") {
      return null;
    }
    const { person } = yield* Member;
    yield* revokeClient(personActor(person), client);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(create),
  Layer.provide(rotate),
  Layer.provide(revoke),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(integrationAccess),
  GroupImpl.finalize
);
