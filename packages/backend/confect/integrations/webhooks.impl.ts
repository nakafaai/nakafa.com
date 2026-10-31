import { FunctionImpl, GroupImpl } from "@confect/server";
import integrationsInternal from "@repo/backend/confect/_generated/refs/integrations.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Integration } from "@repo/backend/confect/integrations/access";
import { integrationAccess } from "@repo/backend/confect/integrations/authority";
import {
  changeWebhook,
  createWebhook,
  endWebhook,
  rotateWebhook,
  webhookOf,
} from "@repo/backend/confect/integrations/webhook";
import spec from "@repo/backend/confect/integrations/webhooks.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Number as Num,
  Option,
  Struct,
} from "effect";

/** The most rows one page of either list reads. A request asks for at least one. */
const PAGE_LIMIT = 100;

/** A page request, with its size clamped into one to `PAGE_LIMIT`. */
const clampPage = <P extends { readonly numItems: number }>(page: P) =>
  Struct.assign(page, {
    numItems: Num.clamp(page.numItems, { maximum: PAGE_LIMIT, minimum: 1 }),
  });

/** The webhooks of the member's school, newest first, a page at a time, each with its client's name. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("integrations.webhooks.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("integrationWebhooks")
      .index("by_tenantId", (query) => query.eq("tenantId", tenant._id), "desc")
      .paginate(clampPage(paginationOpts))
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(
      page.page,
      (webhook) =>
        reader
          .table("integrationClients")
          .get(webhook.clientId)
          .pipe(
            Effect.orDie,
            Effect.map((client) => ({
              changes: webhook.changes,
              clientActions: client.actions,
              clientId: webhook.clientId,
              clientName: client.name,
              createdAt: webhook._creationTime,
              id: webhook._id,
              rotatedAt: webhook.rotatedAt,
              status: webhook.status,
              url: webhook.url,
            }))
          ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: rows });
  })
);

/** The attempts of one webhook, newest first, a page at a time. */
const deliveries = FunctionImpl.make(
  databaseSchema,
  spec,
  "deliveries",
  Effect.fn("integrations.webhooks.deliveries")(function* ({
    paginationOpts,
    webhookId,
  }) {
    const webhook = yield* webhookOf(yield* Integration, webhookId);
    const page = yield* (yield* DatabaseReader)
      .table("integrationDeliveries")
      .index(
        "by_webhookId",
        (query) => query.eq("webhookId", webhook._id),
        "desc"
      )
      .paginate(clampPage(paginationOpts))
      .pipe(Effect.orDie);
    return Struct.assign(page, {
      page: Arr.map(page.page, (delivery) => ({
        attempt: delivery.attempt,
        change: delivery.change,
        createdAt: delivery._creationTime,
        dueAt: delivery.dueAt,
        entryId: delivery.entryId,
        id: delivery._id,
        state: delivery.state,
      })),
    });
  })
);

/** Creates a webhook of an active client. The client's action list must open every change it carries. */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("integrations.webhooks.create")(function* ({ changes, url }) {
    const { person } = yield* Member;
    return yield* createWebhook(personActor(person), yield* Integration, {
      changes,
      url,
    });
  })
);

/** Changes where an active webhook posts and what it carries. */
const change = FunctionImpl.make(
  databaseSchema,
  spec,
  "change",
  Effect.fn("integrations.webhooks.change")(function* ({
    changes,
    url,
    webhookId,
  }) {
    const { person } = yield* Member;
    const client = yield* Integration;
    return yield* changeWebhook(
      personActor(person),
      client,
      yield* webhookOf(client, webhookId),
      { changes, url }
    );
  })
);

/** Draws a new secret for an active webhook, shown once. */
const rotate = FunctionImpl.make(
  databaseSchema,
  spec,
  "rotate",
  Effect.fn("integrations.webhooks.rotate")(function* ({ webhookId }) {
    const { person } = yield* Member;
    const client = yield* Integration;
    return yield* rotateWebhook(
      personActor(person),
      client,
      yield* webhookOf(client, webhookId)
    );
  })
);

/** Ends a webhook. One already ended stays ended, so a retried request succeeds. */
const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("integrations.webhooks.revoke")(function* ({ webhookId }) {
    const client = yield* Integration;
    const webhook = yield* webhookOf(client, webhookId);
    if (webhook.status === "revoked") {
      return null;
    }
    const { person } = yield* Member;
    yield* endWebhook(personActor(person), client, webhook);
    return null;
  })
);

/**
 * Sends a change of the log again, as one more attempt of its own, due at once. Every
 * attempt of a change carries the same event ID, so a receiver that already took it can
 * tell. An attempt of another webhook is refused like one that does not exist.
 */
const resend = FunctionImpl.make(
  databaseSchema,
  spec,
  "resend",
  Effect.fn("integrations.webhooks.resend")(function* ({
    deliveryId,
    webhookId,
  }) {
    const webhook = yield* webhookOf(yield* Integration, webhookId);
    const delivery = yield* (yield* DatabaseReader)
      .table("integrationDeliveries")
      .get(deliveryId)
      .pipe(Effect.option);
    if (
      Option.isNone(delivery) ||
      delivery.value.webhookId !== webhook._id ||
      webhook.status !== "active"
    ) {
      return yield* new AccessDenied({
        action: "integration.manage",
        reason: "resource",
      });
    }
    const at = yield* Clock.currentTimeMillis;
    const resent = yield* (yield* DatabaseWriter)
      .table("integrationDeliveries")
      .insert({
        attempt: delivery.value.attempt + 1,
        change: delivery.value.change,
        dueAt: at,
        entryId: delivery.value.entryId,
        state: { status: "due" },
        tenantId: delivery.value.tenantId,
        webhookId: webhook._id,
      })
      .pipe(Effect.orDie);
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      integrationsInternal.hooks.deliver,
      { deliveryId: resent }
    );
    return null;
  })
);

/** Implements the webhooks group of `webhooks.spec.ts`. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(deliveries),
  Layer.provide(create),
  Layer.provide(change),
  Layer.provide(rotate),
  Layer.provide(revoke),
  Layer.provide(resend),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(integrationAccess),
  GroupImpl.finalize
);
