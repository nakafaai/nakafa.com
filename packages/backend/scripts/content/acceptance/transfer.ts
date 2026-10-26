import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { encodeArguments } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Clock, Effect, Schema } from "effect";

/**
 * Records a bank transfer for a school invoice in the running local acceptance
 * backend, as an operator does once the money arrives, so a browser test can
 * show the school paid. The transfer is dated at the moment the command runs.
 */
export const recordAcceptanceTransfer = Effect.fn(
  "contentAcceptance.recordTransfer"
)(function* (root: string, number: string, reference: string, paidAt: number) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run bun run acceptance:prepare and start acceptance before recording a transfer."
    );
  }
  const args = yield* encodeArguments({ number, paidAt, reference });
  yield* runLocalConvex(runtime, "transfer record", [
    "run",
    "billing/contracts:recordInvoiceTransfer",
    args,
  ]);
});

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
    return yield* recordAcceptanceTransfer(
      root,
      number,
      reference,
      yield* Clock.currentTimeMillis
    );
  }),
} satisfies AcceptanceMode;
