import {
  Contract,
  ContractModule,
} from "@repo/backend/confect/tenancy/contract";
import { OpenRequest } from "@repo/backend/confect/tenancy/provision.spec";
import { TenantKind, UnitLevel } from "@repo/backend/confect/tenancy/schema";
import {
  countryDefaults,
  StartCountry,
} from "@repo/backend/confect/tenancy/start";
import { Array as Arr, Schema } from "effect";

/** What an operator types and chooses to open one school under a contract. */
export const OpenForm = Schema.Struct({
  contentLicense: Schema.String,
  country: StartCountry,
  dpaVersion: Schema.String,
  email: Schema.String,
  kind: TenantKind,
  level: UnitLevel,
  name: Schema.String,
  owner: Schema.String,
  plan: Contract.fields.plan,
  slug: Schema.String,
});

/** The form before the operator fills it: an Indonesian SMA on a whole-tenant licence. */
export const EMPTY_OPEN_FORM: typeof OpenForm.Type = {
  contentLicense: "",
  country: "ID",
  dpaVersion: "",
  email: "",
  kind: "school",
  level: "sma",
  name: "",
  owner: "",
  plan: "tenant",
  slug: "",
};

/** Decodes the request of one opening, when the form makes one. */
const decodeRequest = Schema.decodeUnknownOption(OpenRequest);

/**
 * The opening a form asks for, when every field holds a value the server takes. The
 * school opens with one unit of its own name, every module, and the currency, language
 * and first time zone of its country. An operator adds other units in the school's
 * settings once it is open.
 */
export const openRequest = (form: typeof OpenForm.Type) => {
  const defaults = countryDefaults[form.country];
  const name = form.name.trim();
  return decodeRequest({
    contract: {
      contentLicense: form.contentLicense.trim(),
      dpaVersion: form.dpaVersion.trim(),
      modules: ContractModule.literals,
      plan: form.plan,
    },
    country: form.country,
    currency: defaults.currency,
    kind: form.kind,
    name,
    owner: { email: form.email.trim(), name: form.owner.trim() },
    slug: form.slug,
    units: [
      {
        contentLanguage: defaults.contentLanguage,
        level: form.level,
        name,
        timeZone: Arr.headNonEmpty(defaults.zones),
      },
    ],
  });
};
