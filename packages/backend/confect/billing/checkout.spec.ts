import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  CheckoutSessionIoErrorWire,
  checkoutAdmissionArgsValidator,
  checkoutAdmissionValidator,
} from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/** The billing account a checkout pays through, or that the account is unavailable to buy. */
const openedAccountValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("open"),
    accountId: IdSchema("billingAccounts"),
    authId: Schema.String,
    email: Schema.String,
    name: Schema.String,
    providerCustomerId: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal("unavailable"),
  }),
]).pipe(Schema.toTaggedUnion("kind"));

/**
 * The internal steps of a checkout: open the personal Polar account, record the
 * Polar customer it was linked to, and admit the checkout once Polar has answered.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "openAccount",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => openedAccountValidator,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "recordCustomer",
      args: () => ({
        accountId: IdSchema("billingAccounts"),
        providerCustomerId: Schema.String,
      }),
      returns: () => Schema.Null,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "admitCheckout",
      args: () => checkoutAdmissionArgsValidator.fields,
      returns: () => checkoutAdmissionValidator,
      error: () => CheckoutSessionIoErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "mayAdoptCustomer",
      args: () => ({
        externalId: Schema.NullOr(Schema.String),
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Boolean,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "holdsPro",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Boolean,
    })
  );
