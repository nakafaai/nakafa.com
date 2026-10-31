import { FunctionImpl, GroupImpl } from "@confect/server";
import type { IntegrationDeliveriesDoc } from "@repo/backend/confect/_generated/docs";
import integrationsInternal from "@repo/backend/confect/_generated/refs/integrations.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { attemptOf } from "@repo/backend/confect/integrations/attempt";
import {
  DELIVERY_RETENTION,
  eventOf,
  isPublished,
  retryDelay,
} from "@repo/backend/confect/integrations/hook";
import spec from "@repo/backend/confect/integrations/hooks.spec";
import { clientRead } from "@repo/backend/confect/integrations/reads";
import { readsSubject } from "@repo/backend/confect/integrations/subject";
import { openSecret } from "@repo/backend/confect/integrations/webhook";
import { planRun } from "@repo/backend/confect/journal/cursor";
import {
  advance,
  cursorOf,
  readTenantAfter,
} from "@repo/backend/confect/journal/store";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Clock,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
} from "effect";

/** Journal entries one run reads, as the inbox consumer's run does (ADR 0016). */
const RUN_PAGE = 50;

/** The most IDs one cursor keeps handled, one page, as the inbox consumer's cursor does. */
const HANDLED_LIMIT = RUN_PAGE;

/** The webhooks one sweep's page reads. A longer list continues in a sweep of its own. */
const SWEEP_PAGE = 100;

/** The attempts one sweep sends again. */
const LOST_PAGE = 50;

/** How long an attempt stays due past its time before the sweep counts its scheduled delivery as lost. */
const LOST_AFTER = Duration.minutes(5);

/** The attempts one prune deletes. A longer list continues in a prune of its own. */
const PRUNE_PAGE = 500;

/** How far apart the attempts of one run start, so a burst does not reach a receiver at once. */
const STAGGER = Duration.millis(200);

/** Whether the journal holds an entry after the cursor that the cursor has not handled. */
const hasUnread = Effect.fn("integrations.hooks.unread")(function* (
  webhookId: IntegrationDeliveriesDoc["webhookId"],
  tenantId: IntegrationDeliveriesDoc["tenantId"]
) {
  const cursor = yield* cursorOf(webhookId, tenantId, null);
  if (Option.isNone(cursor)) {
    return false;
  }
  const page = yield* readTenantAfter(tenantId, cursor.value, 0);
  return Arr.some(
    page,
    (entry) =>
      !Arr.some(cursor.value.handled, (kept) => kept.entryId === entry._id)
  );
});

/** Sends again the attempts whose scheduled delivery was lost, the at-most-once of a scheduled action. */
const recoverLost = Effect.fn("integrations.hooks.recover")(function* () {
  const now = yield* Clock.currentTimeMillis;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const lost = yield* (yield* DatabaseReader)
    .table("integrationDeliveries")
    .index("by_state_status_and_dueAt", (query) =>
      query
        .eq("state.status", "due")
        .lt("dueAt", now - Duration.toMillis(LOST_AFTER))
    )
    .take(LOST_PAGE)
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    lost,
    (delivery) =>
      Effect.andThen(
        writer
          .table("integrationDeliveries")
          .patch(delivery._id, { dueAt: now })
          .pipe(Effect.orDie),
        scheduler.runAfter(Duration.zero, integrationsInternal.hooks.deliver, {
          deliveryId: delivery._id,
        })
      ),
    { discard: true }
  );
});

/** Starts a run for each active webhook with unread changes, a page at a time. */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("integrations.hooks.sweep")(function* ({ cursor }) {
    const scheduler = yield* Scheduler;
    const page = yield* (yield* DatabaseReader)
      .table("integrationWebhooks")
      .index("by_status", (query) => query.eq("status", "active"))
      .paginate({ cursor, numItems: SWEEP_PAGE })
      .pipe(Effect.orDie);
    const due = yield* Effect.filter(
      page.page,
      (webhook) => hasUnread(webhook._id, webhook.tenantId),
      { concurrency: "unbounded" }
    );
    yield* Effect.forEach(
      due,
      (webhook) =>
        scheduler.runAfter(Duration.zero, integrationsInternal.hooks.run, {
          webhookId: webhook._id,
        }),
      { discard: true }
    );
    if (cursor === null) {
      yield* recoverLost();
    }
    if (!page.isDone) {
      yield* scheduler.runAfter(
        Duration.zero,
        integrationsInternal.hooks.sweep,
        { cursor: page.continueCursor }
      );
    }
    return null;
  })
);

/**
 * Reads one page of the school's journal after the webhook's cursor and writes the first
 * attempt of each change the webhook carries, in the transaction that moves the cursor, so a
 * change gets exactly one first attempt. The rest of the journal only moves the cursor. An
 * ended webhook has no cursor left, so a run that was already scheduled does nothing.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("integrations.hooks.run")(function* ({ webhookId }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const scheduler = yield* Scheduler;
    const webhook = yield* reader
      .table("integrationWebhooks")
      .get(webhookId)
      .pipe(Effect.orDie);
    const cursor = yield* cursorOf(webhookId, webhook.tenantId, null);
    if (Option.isNone(cursor)) {
      return null;
    }
    const now = yield* Clock.currentTimeMillis;
    const plan = planRun(
      now,
      cursor.value,
      yield* readTenantAfter(webhook.tenantId, cursor.value, RUN_PAGE),
      RUN_PAGE,
      HANDLED_LIMIT
    );
    const carried = Arr.getSomes(
      Arr.map(plan.handle, (entry) => {
        const change = entry.change.type;
        return isPublished(change) && Arr.contains(webhook.changes, change)
          ? Option.some({ change, entry })
          : Option.none();
      })
    );
    yield* Effect.forEach(carried, ({ change, entry }, index) =>
      Effect.flatMap(
        writer
          .table("integrationDeliveries")
          .insert({
            attempt: 1,
            change,
            dueAt: now,
            entryId: entry._id,
            state: { status: "due" },
            tenantId: webhook.tenantId,
            webhookId,
          })
          .pipe(Effect.orDie),
        (deliveryId) =>
          scheduler.runAfter(
            Duration.times(STAGGER, index),
            integrationsInternal.hooks.deliver,
            { deliveryId }
          )
      )
    );
    yield* advance(
      cursor.value._id,
      plan.position,
      Option.isSome(plan.nextRunAt)
    );
    if (Option.isSome(plan.nextRunAt)) {
      yield* scheduler.runAt(
        DateTime.makeUnsafe(plan.nextRunAt.value),
        integrationsInternal.hooks.run,
        { webhookId }
      );
    }
    return null;
  })
);

/**
 * What one attempt sends. The webhook and the client are read again, and the client's
 * access to the subject is decided now (ADR 0016), so a change is sent only while the
 * client could read it. An attempt that a retried action already settled sends nothing.
 */
const prepare = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepare",
  Effect.fn("integrations.hooks.prepare")(function* ({ deliveryId }) {
    const reader = yield* DatabaseReader;
    const delivery = yield* reader
      .table("integrationDeliveries")
      .get(deliveryId)
      .pipe(Effect.orDie);
    if (delivery.state.status !== "due") {
      return { outcome: "settled" as const };
    }
    const webhook = yield* reader
      .table("integrationWebhooks")
      .get(delivery.webhookId)
      .pipe(Effect.orDie);
    if (webhook.secret === null) {
      return { outcome: "drop" as const, reason: "revoked" as const };
    }
    const read = yield* clientRead(webhook.clientId);
    const entry = yield* reader
      .table("journalEntries")
      .get(delivery.entryId)
      .pipe(Effect.orDie);
    if (!(yield* readsSubject(entry, read))) {
      return { outcome: "drop" as const, reason: "access" as const };
    }
    return {
      attempt: delivery.attempt,
      body: encodeJsonText(eventOf(entry)),
      event: entry._id,
      outcome: "send" as const,
      secret: yield* openSecret(webhook, webhook.secret),
      type: entry.change.type,
      url: webhook.url,
    };
  })
);

/** Sends one attempt and settles it. */
const deliver = FunctionImpl.make(
  databaseSchema,
  spec,
  "deliver",
  Effect.fn("integrations.hooks.deliver.run")(function* ({ deliveryId }) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const prepared = yield* runQuery(integrationsInternal.hooks.prepare, {
      deliveryId,
    }).pipe(Effect.orDie);
    if (prepared.outcome === "settled") {
      return null;
    }
    const outcome =
      prepared.outcome === "drop"
        ? { reason: prepared.reason, status: "dropped" as const }
        : yield* attemptOf(prepared);
    yield* runMutation(integrationsInternal.hooks.settle, {
      deliveryId,
      outcome,
    }).pipe(Effect.orDie);
    return null;
  })
);

/**
 * Settles one attempt and writes the next one after a failure, until the attempts run out.
 * Each attempt keeps its own row, so the log shows every try. An attempt settled already, by
 * an action the sweep sent again, stays as it is.
 */
const settle = FunctionImpl.make(
  databaseSchema,
  spec,
  "settle",
  Effect.fn("integrations.hooks.settle")(function* ({ deliveryId, outcome }) {
    const writer = yield* DatabaseWriter;
    const delivery = yield* (yield* DatabaseReader)
      .table("integrationDeliveries")
      .get(deliveryId)
      .pipe(Effect.orDie);
    if (delivery.state.status !== "due") {
      return null;
    }
    const at = yield* Clock.currentTimeMillis;
    yield* writer
      .table("integrationDeliveries")
      .patch(deliveryId, { state: { ...outcome, at } })
      .pipe(Effect.orDie);
    const delay = retryDelay(delivery.attempt);
    if (outcome.status !== "failed" || Option.isNone(delay)) {
      return null;
    }
    const dueAt = at + Duration.toMillis(delay.value);
    const next = yield* writer
      .table("integrationDeliveries")
      .insert({
        attempt: delivery.attempt + 1,
        change: delivery.change,
        dueAt,
        entryId: delivery.entryId,
        state: { status: "due" },
        tenantId: delivery.tenantId,
        webhookId: delivery.webhookId,
      })
      .pipe(Effect.orDie);
    yield* (yield* Scheduler).runAt(
      DateTime.makeUnsafe(dueAt),
      integrationsInternal.hooks.deliver,
      { deliveryId: next }
    );
    return null;
  })
);

/** Deletes the attempts past the log's retention, oldest first, a page at a time. */
const prune = FunctionImpl.make(
  databaseSchema,
  spec,
  "prune",
  Effect.fn("integrations.hooks.prune")(function* () {
    const writer = yield* DatabaseWriter;
    const cutoff =
      (yield* Clock.currentTimeMillis) - Duration.toMillis(DELIVERY_RETENTION);
    const old = yield* (yield* DatabaseReader)
      .table("integrationDeliveries")
      .index("by_creation_time", (query) => query.lt("_creationTime", cutoff))
      .take(PRUNE_PAGE)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      old,
      (delivery) =>
        writer
          .table("integrationDeliveries")
          .delete(delivery._id)
          .pipe(Effect.orDie),
      { discard: true }
    );
    if (old.length === PRUNE_PAGE) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        integrationsInternal.hooks.prune,
        {}
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(sweep),
  Layer.provide(run),
  Layer.provide(prepare),
  Layer.provide(deliver),
  Layer.provide(settle),
  Layer.provide(prune),
  GroupImpl.finalize
);
