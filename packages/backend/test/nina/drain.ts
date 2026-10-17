import { RegisteredFunction } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { drainSeals } from "@repo/backend/confect/nina/sealed/drain";
import type { createNinaTest } from "@repo/backend/test/nina";
import { Array as Arr, Effect, Logger, MutableRef, Order } from "effect";

type Deployment = Awaited<ReturnType<typeof createNinaTest>>;

/** The log entries that the drains of a test wrote, as the logger of `drainIn` read them. */
export const logged = MutableRef.make<readonly unknown[]>([]);

/** Each settled turn of the chat, oldest first, with what the drain left of it. */
export async function settled(t: Deployment["t"]) {
  const turns = await t.query((ctx) => ctx.db.query("ninaTurns").collect());
  const rows = Arr.flatMap(turns, (turn) =>
    turn.phase === "settled"
      ? [
          {
            _id: turn._id,
            hold: turn.sealHold,
            order: turn.order,
            sealAttempts: turn.sealAttempts,
            sealFailedAt: turn.sealFailedAt,
            sealed: turn.sealedAt !== undefined,
          },
        ]
      : []
  );
  return Arr.sortWith(rows, (row) => row.order, Order.Number);
}

/** The settled turn of the fixture at `order`, as the drain's test reads it. */
export async function turnAt(t: Deployment["t"], order: number) {
  return Effect.runPromise(
    Effect.fromOption(
      Arr.findFirst(await settled(t), (turn) => turn.order === order)
    ).pipe(Effect.orDie)
  );
}

/**
 * Runs one drain as the sweep's action runs it, with its logs captured in `logged`.
 * The drain reads and writes through the runners of an action.
 */
export function drainIn(f: Deployment, budget: number) {
  return f.t.action((ctx) =>
    Effect.runPromise(
      drainSeals(budget).pipe(
        Effect.provide([
          RegisteredFunction.actionLayer(schema, ctx),
          Logger.layer([
            Logger.formatStructured.pipe(
              Logger.map(({ message }) =>
                MutableRef.update(logged, Arr.append(message))
              )
            ),
          ]),
        ])
      )
    )
  );
}
