import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { IntegrationAccess } from "@repo/backend/confect/integrations/access";
import {
  ActionClosed,
  WebhookLimit,
} from "@repo/backend/confect/integrations/errors";
import {
  DeliveryState,
  ReceiverUrl,
  WebhookChange,
  WebhookChanges,
} from "@repo/backend/confect/integrations/hook";
import {
  ClientActions,
  IntegrationName,
  IntegrationStatus,
} from "@repo/backend/confect/integrations/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One webhook as its school's list shows it. Its secret never leaves the server. */
const WebhookView = Schema.Struct({
  changes: WebhookChanges,
  clientActions: ClientActions,
  clientId: Id("integrationClients"),
  clientName: IntegrationName,
  createdAt: Schema.Finite,
  id: Id("integrationWebhooks"),
  rotatedAt: Schema.Finite,
  status: IntegrationStatus,
  url: ReceiverUrl,
});

/** One attempt of the delivery log. */
const DeliveryView = Schema.Struct({
  attempt: Schema.Finite,
  change: WebhookChange,
  createdAt: Schema.Finite,
  dueAt: Schema.Finite,
  entryId: Id("journalEntries"),
  id: Id("integrationDeliveries"),
  state: DeliveryState,
});

/** A webhook's secret, returned once to the caller that created or rotated it. */
const IssuedWebhook = Schema.Struct({
  id: Id("integrationWebhooks"),
  secret: Schema.String,
});

/** What names one webhook: its client, on which the call is decided, and its own ID. */
const webhookArgs = {
  clientId: Id("integrationClients"),
  slug: TenantSlug,
  webhookId: Id("integrationWebhooks"),
};

/**
 * The webhooks of one school. Its Owner and Admin create, change, rotate and revoke them,
 * read the delivery log, and send a failed change again. A webhook belongs to one client,
 * so each call is decided on that client. A secret is shown once.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () => WebhookView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "integration.view" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "deliveries",
      args: () => webhookArgs,
      item: () => DeliveryView,
      error: () => AccessDenied,
    }).middleware(IntegrationAccess, {
      action: "integration.view",
      arg: "clientId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        changes: WebhookChanges,
        clientId: Id("integrationClients"),
        slug: TenantSlug,
        url: ReceiverUrl,
      }),
      returns: () => IssuedWebhook,
      error: () => Schema.Union([AccessDenied, ActionClosed, WebhookLimit]),
    }).middleware(IntegrationAccess, {
      action: "integration.manage",
      arg: "clientId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "change",
      args: () => ({
        ...webhookArgs,
        changes: WebhookChanges,
        url: ReceiverUrl,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, ActionClosed]),
    }).middleware(IntegrationAccess, {
      action: "integration.manage",
      arg: "clientId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rotate",
      args: () => webhookArgs,
      returns: () => IssuedWebhook,
      error: () => AccessDenied,
    }).middleware(IntegrationAccess, {
      action: "integration.manage",
      arg: "clientId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "revoke",
      args: () => webhookArgs,
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(IntegrationAccess, {
      action: "integration.view",
      arg: "clientId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "resend",
      args: () => ({
        ...webhookArgs,
        deliveryId: Id("integrationDeliveries"),
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(IntegrationAccess, {
      action: "integration.manage",
      arg: "clientId",
    })
  );
