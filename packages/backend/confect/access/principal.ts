import integrationClients from "@repo/backend/confect/_generated/tables/integrationClients";
import tenants from "@repo/backend/confect/_generated/tables/tenants";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Schema } from "effect";

/**
 * An integration client that a school API request verified, with its tenant.
 * Only the HTTP layer builds one, and it passes one to internal functions only.
 * `decide` never reads the client's secret digest.
 */
export const ClientPrincipal = Schema.Struct({
  client: integrationClients.Doc,
  tenant: tenants.Doc,
});

/**
 * The caller a decision is about: a Person through `Member`, or an integration
 * client. Both carry the tenant they act in.
 */
export type Principal = Member["Service"] | typeof ClientPrincipal.Type;
