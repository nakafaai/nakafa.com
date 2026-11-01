import type { JournalEntriesDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import type { Action } from "@repo/backend/confect/access/catalog";
import { IntegrationStatus } from "@repo/backend/confect/integrations/schema";
import { isPublicHttpUrlSyntax } from "@repo/backend/confect/nina/research/url";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Array as Arr, DateTime, Duration, Schema, Struct } from "effect";

/** The changes a webhook can carry: every change type the catalog publishes (ADR 0016). */
export const WebhookChange = Schema.Literals([
  "grade.released",
  "grant.created",
  "grant.ended",
  "guardian.linked",
  "guardian.withdrawn",
  "unit.created",
]);

/**
 * The action a client must hold to receive each change: the read of its subject. A client
 * subscribes only to what its action list opens, and delivery decides the subject again.
 */
export const WEBHOOK_READS = {
  "grade.released": "grade.export",
  "grant.created": "person.view",
  "grant.ended": "person.view",
  "guardian.linked": "guardian.view",
  "guardian.withdrawn": "guardian.view",
  "unit.created": "unit.view",
} as const satisfies Record<typeof WebhookChange.Type, typeof Action.Type>;

/** The changes one webhook carries: a non-empty list of distinct changes. */
export const WebhookChanges = Schema.NonEmptyArray(WebhookChange).check(
  Schema.isUnique()
);

/** The longest receiver address a webhook keeps. */
const RECEIVER_LENGTH = 2048;

/**
 * The address a webhook posts to: HTTPS, with no credentials, on a name or an address the
 * research scrape guard does not refuse. Delivery judges what the name resolves to as well.
 */
export const ReceiverUrl = Schema.String.check(
  Schema.isMaxLength(RECEIVER_LENGTH),
  Schema.makeFilter(
    (url) =>
      (url.startsWith("https://") && isPublicHttpUrlSyntax(url)) ||
      "A receiver is a public HTTPS address."
  )
);

/**
 * Whether a webhook holds the state its status names. An active webhook holds its sealed
 * secret and no revocation time, and a revoked one the reverse, so a revoked webhook keeps
 * no way to sign.
 */
const holdsItsState = (webhook: {
  readonly revokedAt: number | null;
  readonly secret: ArrayBuffer | null;
  readonly status: typeof IntegrationStatus.Type;
}) =>
  webhook.status === "active"
    ? webhook.secret !== null && webhook.revokedAt === null
    : webhook.secret === null && webhook.revokedAt !== null;

/**
 * One webhook of an integration client. The secret is sealed with the school's key and not
 * hashed, because the server signs with it (ADR 0029, ADR 0030).
 */
export const integrationWebhookValidator = Schema.Struct({
  changes: WebhookChanges,
  clientId: Id("integrationClients"),
  revokedAt: Schema.NullOr(Schema.Finite),
  rotatedAt: Schema.Finite,
  secret: Schema.NullOr(Sealed),
  status: IntegrationStatus,
  tenantId: Id("tenants"),
  url: ReceiverUrl,
}).check(
  Schema.makeFilter(holdsItsState, {
    message:
      "An active webhook holds a secret and no revocation time; a revoked webhook holds a revocation time and no secret.",
  })
);

/** Why one attempt failed: its receiver is no public address, it answered no success, it could not be reached, or it took too long. */
const DeliveryFailure = Schema.Literals([
  "address",
  "deadline",
  "network",
  "status",
]);

/** Why a change was not sent: its client may no longer read its subject, or the webhook has ended. */
export const DeliveryDrop = Schema.Literals(["access", "revoked"]);

/** The fields of an attempt that reached its receiver or failed trying. */
const delivered = {
  code: Schema.Finite,
  ms: Schema.Finite,
  status: Schema.Literal("delivered"),
};
const failed = {
  code: Schema.NullOr(Schema.Finite),
  ms: Schema.Finite,
  reason: DeliveryFailure,
  status: Schema.Literal("failed"),
};
const dropped = { reason: DeliveryDrop, status: Schema.Literal("dropped") };

/** The outcome that one attempt settles with. */
export const DeliveryOutcome = Schema.Union([
  Schema.Struct(delivered),
  Schema.Struct(failed),
  Schema.Struct(dropped),
]);

/** Where one attempt stands: due, or settled at `at`. */
export const DeliveryState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("due") }),
  Schema.Struct({ ...delivered, at: Schema.Finite }),
  Schema.Struct({ ...failed, at: Schema.Finite }),
  Schema.Struct({ ...dropped, at: Schema.Finite }),
]);

/**
 * One attempt to deliver one change to one webhook, the delivery log of ADR 0029. Each
 * retry is a row of its own, and the journal entry is the event ID every attempt carries.
 */
export const integrationDeliveryValidator = Schema.Struct({
  attempt: Schema.Finite,
  change: WebhookChange,
  dueAt: Schema.Finite,
  entryId: Id("journalEntries"),
  state: DeliveryState,
  tenantId: Id("tenants"),
  webhookId: Id("integrationWebhooks"),
});

/** Whether a journal entry's change is one the catalog publishes. */
export const isPublished = Schema.is(WebhookChange);

/**
 * The event of a journal entry, the same for a webhook and for the REST and MCP reads: the
 * published change and its subject, which hold IDs, enums and reason codes only (ADR 0016).
 */
export const eventOf = (entry: JournalEntriesDoc) => ({
  change: Struct.omit(entry.change, ["type"]),
  id: entry._id,
  occurredAt: DateTime.formatIso(DateTime.makeUnsafe(entry._creationTime)),
  subject: entry.subject,
  type: entry.change.type,
});

/** The webhooks one client may hold. A school sends one system its changes, so ten leaves room to migrate. */
export const WEBHOOK_LIMIT = 10;

/**
 * How long each retry waits: seven growing delays, so a change gets eight attempts inside
 * 24 hours, the target of ADR 0029.
 */
const RETRY_DELAYS = [
  Duration.seconds(30),
  Duration.minutes(2),
  Duration.minutes(10),
  Duration.minutes(30),
  Duration.hours(2),
  Duration.hours(6),
  Duration.hours(15),
];

/** The delay before the attempt after `attempt`, or none once the last attempt has failed. */
export const retryDelay = (attempt: number) =>
  Arr.get(RETRY_DELAYS, attempt - 1);

/** How long the delivery log keeps an attempt. A school reads it to debug, so a month is enough. */
export const DELIVERY_RETENTION = Duration.days(30);
