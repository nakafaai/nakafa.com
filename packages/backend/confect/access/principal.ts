import integrationClients from "@repo/backend/confect/_generated/tables/integrationClients";
import tenants from "@repo/backend/confect/_generated/tables/tenants";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Schema } from "effect";

/**
 * An integration client that a school API request verified, with its tenant.
 * Only the HTTP layer builds one, and it passes one to internal functions only.
 * A client belongs to one school, so decoding refuses a pair with another
 * school's tenant. The type does not carry that check, so `decide` refuses such
 * a pair too. `decide` never reads the client's secret digest.
 */
export const ClientPrincipal = Schema.Struct({
  client: integrationClients.Doc,
  tenant: tenants.Doc,
}).check(
  Schema.makeFilter(({ client, tenant }) => client.tenantId === tenant._id, {
    message: "A client decides only for the school it belongs to.",
  })
);

/**
 * The caller a decision is about: a Person through `Member`, or an integration
 * client. Both carry the tenant they act in.
 */
export type Principal = Member["Service"] | typeof ClientPrincipal.Type;
