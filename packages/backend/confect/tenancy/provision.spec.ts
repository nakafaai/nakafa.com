import { FunctionSpec, GroupSpec } from "@confect/core";
import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { Contract } from "@repo/backend/confect/tenancy/contract";
import { ProvisionRejected } from "@repo/backend/confect/tenancy/errors";
import { NewCurrency, NewTimeZone } from "@repo/backend/confect/tenancy/locale";
import {
  Email,
  PersonName,
  TenantKind,
  TenantName,
  unitFields,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One school that a new organisation opens with. */
export const UnitDraft = Schema.Struct({
  ...unitFields,
  timeZone: NewTimeZone,
});

/** The fields an organisation opens with. Nakafa staff and the operator console send the same ones. */
export const openArgs = {
  contract: Contract,
  country: CountryCodeSchema,
  currency: NewCurrency,
  kind: TenantKind,
  name: TenantName,
  owner: Schema.Struct({ email: Email, name: PersonName }),
  slug: TenantSlug,
  units: Schema.Array(UnitDraft),
};
/** The arguments of one opening, as the console and the command line send them. */
export const OpenRequest = Schema.Struct(openArgs);

/** What opening an organisation writes: its tenant, its schools, its first Owner, and the invite. */
export const openResult = Schema.Struct({
  invite: Id("tenantInvites"),
  owner: Id("tenantPeople"),
  tenant: Id("tenants"),
  units: Schema.Array(Id("tenantUnits")),
});

/** A Person invited into a school that exists, and the address that receives the invite. */
const inviteArgs = {
  email: Email,
  locale: ActiveAppLocaleCodeSchema,
  name: PersonName,
  slug: TenantSlug,
};
/** The arguments of one invite, as the command line sends them. */
export const InviteRequest = Schema.Struct(inviteArgs);

/** What inviting a Person writes: the new Person and its pending invite. */
const inviteResult = Schema.Struct({
  invite: Id("tenantInvites"),
  person: Id("tenantPeople"),
});

/**
 * Opens an organisation, the way Nakafa staff do it from the command line with
 * the deployment's key. It is internal, so no browser can call it.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "open",
      args: () => openArgs,
      returns: () => openResult,
      error: () => ProvisionRejected,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "invite",
      args: () => inviteArgs,
      returns: () => inviteResult,
      error: () => ProvisionRejected,
    })
  );
