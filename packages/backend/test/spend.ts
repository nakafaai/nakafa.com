import { Meter } from "@repo/backend/confect/spend/meter";
import { Escrow, SpendRefused } from "@repo/backend/confect/spend/schema";
import { Array as Arr, Effect, Layer, MutableRef, Schema } from "effect";

/**
 * A meter that records every hold and settle as a line, and holds whatever it
 * is asked, or refuses every hold when `refuse` is set. `calls` reads the lines
 * in order; `service` is the meter itself and `layer` provides it.
 */
export function recordingMeter(refuse = false) {
  const calls = MutableRef.make<readonly string[]>([]);
  const service = Meter.of({
    hold: (work, held) =>
      refuse
        ? Effect.fail(
            new SpendRefused({ budget: 0, held, used: 0, vendor: "anthropic" })
          )
        : Effect.sync(() => {
            MutableRef.update(calls, Arr.append(`hold ${work} ${held}`));
            return Schema.decodeUnknownSync(Escrow)({
              escrowId: "escrow",
              held,
            });
          }),
    settle: (_escrow, spent) =>
      Effect.sync(() =>
        MutableRef.update(calls, Arr.append(`settle ${spent}`))
      ),
  });
  return {
    calls: () => MutableRef.get(calls),
    layer: Layer.succeed(Meter, service),
    service,
  };
}
