import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { FoundingRefused } from "@repo/backend/confect/tenancy/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  AddressState,
  StartAnswer,
  StartDraft,
  startArgs,
} from "@repo/backend/confect/tenancy/start";
import { Schema } from "effect";

/** An account that is signed out, or that cannot act, gets these failures. */
const AccountFailure = Schema.Union([SessionRequired, AccountUnavailable]);

/**
 * The questionnaire that opens a school for the account that answers it (K42):
 * its saved answers, the live check of an address, and the opening itself.
 */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "draft",
      args: () => ({}),
      returns: () => Schema.NullOr(StartDraft),
      error: () => AccountFailure,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "save",
      args: () => ({ answer: StartAnswer }),
      returns: () => StartDraft,
      error: () => AccountFailure,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "address",
      args: () => ({ slug: Schema.String.check(Schema.isMaxLength(64)) }),
      returns: () => AddressState,
      error: () => AccountFailure,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => startArgs,
      returns: () =>
        Schema.Struct({ address: Schema.String, slug: TenantSlug }),
      error: () => Schema.Union([AccountFailure, FoundingRefused]),
    })
  );
