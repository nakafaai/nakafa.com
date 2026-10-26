import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  issueContractInvoice,
  recordInvoiceTransfer,
  recordSchoolContract,
  recordSchoolPilot,
} from "@repo/backend/confect/billing/contracts";
import spec from "@repo/backend/confect/billing/contracts.spec";
import { requestInvoiceSession } from "@repo/backend/confect/billing/school";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const recordContract = FunctionImpl.make(
  databaseSchema,
  spec,
  "recordSchoolContract",
  Effect.fn("billing.contracts.impl.recordSchoolContract")(function* (args) {
    return yield* recordSchoolContract(args);
  })
);

const recordPilot = FunctionImpl.make(
  databaseSchema,
  spec,
  "recordSchoolPilot",
  Effect.fn("billing.contracts.impl.recordSchoolPilot")(function* (args) {
    return yield* recordSchoolPilot(args);
  })
);

/**
 * Issues an Enterprise contract invoice, and asks for its hosted payment while
 * Xendit takes Indonesia. A contract bills seats for the school year it covers.
 */
const issueInvoice = FunctionImpl.make(
  databaseSchema,
  spec,
  "issueContractInvoice",
  Effect.fn("billing.contracts.impl.issueContractInvoice")(function* (args) {
    // An exhausted invoice sequence is a ledger fault the operator cannot fix by retrying.
    const { invoiceId, number, tenant, total } = yield* issueContractInvoice(
      args
    ).pipe(Effect.catchTag("InvoiceNumberExhausted", Effect.die));
    yield* requestInvoiceSession(tenant, invoiceId, "school.seat.year");
    return { invoiceId, number, total };
  })
);

const recordTransfer = FunctionImpl.make(
  databaseSchema,
  spec,
  "recordInvoiceTransfer",
  Effect.fn("billing.contracts.impl.recordInvoiceTransfer")(function* (args) {
    return yield* recordInvoiceTransfer(args);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(recordContract),
  Layer.provide(recordPilot),
  Layer.provide(issueInvoice),
  Layer.provide(recordTransfer),
  Layer.provide(atomic),
  GroupImpl.finalize
);
