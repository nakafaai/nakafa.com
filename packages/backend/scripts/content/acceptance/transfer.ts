import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Clock, Effect, Schema } from "effect";

/**
 * Records a bank transfer for a school invoice in the running local acceptance
 * backend, as an operator does once the money arrives, so a browser test can
 * show the school paid. The transfer is dated at the moment it is recorded.
 */
export const recordTransfer = Effect.fn("contentAcceptance.recordTransfer")(
  function* (number: string, reference: string) {
    const { run } = yield* LocalConvex;
    const paidAt = yield* Clock.currentTimeMillis;
    yield* run("transfer record", {
      args: { number, paidAt, reference },
      path: "billing/contracts:recordInvoiceTransfer",
    });
  }
);

/** The usage of the transfer mode: the invoice number, then the bank reference. */
const USAGE = "transfer <invoice-number> <bank-reference>";
const TransferArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The transfer mode of the acceptance command line: records the bank transfer the
 * command names for the invoice it names. Arguments after the reference are ignored.
 */
export const transferMode = {
  mode: "transfer",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runTransfer")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [number, reference] = yield* decodeModeArguments(
      USAGE,
      TransferArguments,
      args
    );
    yield* recordTransfer(number, reference).pipe(
      Effect.provide(localConvexLayer(root))
    );
  }),
} satisfies AcceptanceMode;
