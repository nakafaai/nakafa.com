import type { GenericId } from "@confect/core";
import type {
  IntegrationClientsDoc,
  IntegrationWebhooksDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { integrationAuthority } from "@repo/backend/confect/integrations/authority";
import {
  ActionClosed,
  WebhookLimit,
} from "@repo/backend/confect/integrations/errors";
import {
  type ReceiverUrl,
  WEBHOOK_LIMIT,
  WEBHOOK_READS,
  type WebhookChanges,
} from "@repo/backend/confect/integrations/hook";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { cursorOf } from "@repo/backend/confect/journal/store";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { issueToken } from "@repo/utilities/token";
import { Array as Arr, Clock, Effect, Option, Struct } from "effect";

/**
 * The stored field a webhook's secret belongs to. The row names the client, because a
 * webhook's own ID does not exist until its sealed secret is written, so a secret copied to
 * another client's webhook never opens.
 */
const secretField = (clientId: GenericId.GenericId<"integrationClients">) =>
  ({
    field: "secret",
    row: [clientId],
    table: "integrationWebhooks",
  }) satisfies typeof VaultField.Type;

/** Draws a new signing secret and seals it with the school's key. The plain secret is shown once. */
const drawSecret = Effect.fn("integrations.webhook.secret")(function* (
  client: IntegrationClientsDoc
) {
  const { token: secret } = yield* issueToken().pipe(Effect.orDie);
  const keys = yield* readTenantKeys(client.tenantId);
  const sealed = yield* sealText(keys, secretField(client._id), secret).pipe(
    Effect.orDie
  );
  return { sealed, secret };
});

/** Opens a webhook's signing secret. A secret that does not open is a defect: only this module seals one. */
export const openSecret = Effect.fn("integrations.webhook.open")(function* (
  webhook: IntegrationWebhooksDoc,
  sealed: ArrayBuffer
) {
  const keys = yield* readTenantKeys(webhook.tenantId);
  return yield* openText(keys, secretField(webhook.clientId), sealed).pipe(
    Effect.orDie
  );
});

/** Refuses a list that names a change the client's own action list does not open. */
export const requireReadableChanges = Effect.fn("integrations.webhook.changes")(
  function* (
    client: IntegrationClientsDoc,
    changes: typeof WebhookChanges.Type
  ) {
    if (
      Arr.some(
        changes,
        (change) => !Arr.contains(client.actions, WEBHOOK_READS[change])
      )
    ) {
      return yield* new ActionClosed();
    }
  }
);

/** The active webhooks of one client, read on its status, at most one past the limit. */
const activeWebhooksOf = Effect.fn("integrations.webhook.of")(function* (
  clientId: GenericId.GenericId<"integrationClients">
) {
  return yield* (yield* DatabaseReader)
    .table("integrationWebhooks")
    .index("by_clientId_and_status", (query) =>
      query.eq("clientId", clientId).eq("status", "active")
    )
    .take(WEBHOOK_LIMIT + 1)
    .pipe(Effect.orDie);
});

/**
 * Creates a webhook of a client and its cursor, which starts now, so the webhook carries
 * the changes after it was made. Its secret is returned once.
 */
export const createWebhook = Effect.fn("integrations.webhook.create")(
  function* (
    actor: typeof TenantActor.Type,
    client: IntegrationClientsDoc,
    input: {
      changes: typeof WebhookChanges.Type;
      url: typeof ReceiverUrl.Type;
    }
  ) {
    yield* requireReadableChanges(client, input.changes);
    const held = yield* activeWebhooksOf(client._id);
    if (held.length >= WEBHOOK_LIMIT) {
      return yield* new WebhookLimit();
    }
    const at = yield* Clock.currentTimeMillis;
    const { sealed, secret } = yield* drawSecret(client);
    const writer = yield* DatabaseWriter;
    const webhookId = yield* writer
      .table("integrationWebhooks")
      .insert({
        changes: input.changes,
        clientId: client._id,
        revokedAt: null,
        rotatedAt: at,
        secret: sealed,
        status: "active",
        tenantId: client.tenantId,
        url: input.url,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("journalCursors")
      .insert({
        changeType: null,
        consumer: webhookId,
        handled: [],
        pending: false,
        since: at,
        tenantId: client.tenantId,
      })
      .pipe(Effect.orDie);
    yield* integrationAuthority.record(actor, client, {
      client: client._id,
      type: "integration.webhook.created",
      webhook: webhookId,
    });
    return { id: webhookId, secret };
  }
);

/** The webhook an ID names, when it belongs to the client the call was decided on. */
export const webhookOf = Effect.fn("integrations.webhook.load")(function* (
  client: IntegrationClientsDoc,
  webhookId: GenericId.GenericId<"integrationWebhooks">
) {
  const webhook = yield* (yield* DatabaseReader)
    .table("integrationWebhooks")
    .get(webhookId)
    .pipe(Effect.option);
  if (Option.isNone(webhook) || webhook.value.clientId !== client._id) {
    return yield* new AccessDenied({
      action: "integration.view",
      reason: "resource",
    });
  }
  return webhook.value;
});

/** Changes where an active webhook posts and what it carries. An ended webhook is refused. */
export const changeWebhook = Effect.fn("integrations.webhook.change")(
  function* (
    actor: typeof TenantActor.Type,
    client: IntegrationClientsDoc,
    webhook: IntegrationWebhooksDoc,
    input: {
      changes: typeof WebhookChanges.Type;
      url: typeof ReceiverUrl.Type;
    }
  ) {
    yield* requireReadableChanges(client, input.changes);
    yield* requireActive(webhook);
    yield* (yield* DatabaseWriter)
      .table("integrationWebhooks")
      .replace(
        webhook._id,
        Struct.assign(Struct.omit(webhook, ["_creationTime", "_id"]), input)
      )
      .pipe(Effect.orDie);
    yield* integrationAuthority.record(actor, client, {
      client: client._id,
      type: "integration.webhook.changed",
      webhook: webhook._id,
    });
    return null;
  }
);

/** Refuses a webhook that has ended, as a revoked client is refused. */
const requireActive = Effect.fn("integrations.webhook.active")(function* (
  webhook: IntegrationWebhooksDoc
) {
  if (webhook.status !== "active") {
    return yield* new AccessDenied({
      action: "integration.manage",
      reason: "condition",
    });
  }
});

/** Draws a new secret for an active webhook. The old one stops signing at once. The new one is shown once. */
export const rotateWebhook = Effect.fn("integrations.webhook.rotate")(
  function* (
    actor: typeof TenantActor.Type,
    client: IntegrationClientsDoc,
    webhook: IntegrationWebhooksDoc
  ) {
    yield* requireActive(webhook);
    const at = yield* Clock.currentTimeMillis;
    const { sealed, secret } = yield* drawSecret(client);
    yield* (yield* DatabaseWriter)
      .table("integrationWebhooks")
      .replace(
        webhook._id,
        Struct.assign(Struct.omit(webhook, ["_creationTime", "_id"]), {
          rotatedAt: at,
          secret: sealed,
        })
      )
      .pipe(Effect.orDie);
    yield* integrationAuthority.record(actor, client, {
      client: client._id,
      type: "integration.webhook.rotated",
      webhook: webhook._id,
    });
    return { id: webhook._id, secret };
  }
);

/**
 * Ends an active webhook: it holds no secret from now on, its cursor goes, and an attempt
 * still due drops at its turn. The delivery log stays until it ages out.
 */
export const endWebhook = Effect.fn("integrations.webhook.end")(function* (
  actor: typeof TenantActor.Type,
  client: IntegrationClientsDoc,
  webhook: IntegrationWebhooksDoc
) {
  const at = yield* Clock.currentTimeMillis;
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("integrationWebhooks")
    .replace(
      webhook._id,
      Struct.assign(Struct.omit(webhook, ["_creationTime", "_id"]), {
        revokedAt: at,
        secret: null,
        status: "revoked",
      })
    )
    .pipe(Effect.orDie);
  const cursor = yield* cursorOf(webhook._id, webhook.tenantId, null);
  if (Option.isSome(cursor)) {
    yield* writer
      .table("journalCursors")
      .delete(cursor.value._id)
      .pipe(Effect.orDie);
  }
  yield* integrationAuthority.record(actor, client, {
    client: client._id,
    type: "integration.webhook.revoked",
    webhook: webhook._id,
  });
});

/** Ends every active webhook of a client, in the transaction that revokes it (ADR 0029). */
export const endClientWebhooks = Effect.fn("integrations.webhook.endAll")(
  function* (actor: typeof TenantActor.Type, client: IntegrationClientsDoc) {
    yield* Effect.forEach(
      yield* activeWebhooksOf(client._id),
      (webhook) => endWebhook(actor, client, webhook),
      { discard: true }
    );
  }
);
