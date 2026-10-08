import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/nina/usage.spec";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** Adds a call's cost to its row's total; a row that no call has priced stays unpriced. */
function sumCost(total: number | undefined, cost: number | undefined) {
  if (total === undefined && cost === undefined) {
    return {};
  }
  return { cost: (total ?? 0) + (cost ?? 0) };
}

/** Agent invokes this after every model response, including repair and synthesis. */
const record = FunctionImpl.make(
  schema,
  spec,
  "record",
  Effect.fn("nina.usage.record")(function* ({ turnId, usage }) {
    const turn = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .get(turnId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!turn) {
      return null;
    }
    let totals = [...turn.usage];
    const index = Option.getOrElse(
      Arr.findFirstIndex(
        totals,
        (row) =>
          row.agent === usage.agent &&
          row.model === usage.model &&
          row.provider === usage.provider
      ),
      () => -1
    );
    const previous = totals[index];
    if (previous) {
      totals[index] = {
        ...usage,
        input: previous.input + usage.input,
        output: previous.output + usage.output,
        calls: previous.calls + 1,
        ...sumCost(previous.cost, usage.cost),
      };
    } else {
      totals = Arr.append(totals, { ...usage, calls: 1 });
    }
    const input = Arr.reduce(totals, 0, (total, row) => total + row.input);
    const output = Arr.reduce(totals, 0, (total, row) => total + row.output);
    yield* (yield* DatabaseWriter)
      .table("ninaTurns")
      .patch(turnId, {
        usage: totals,
        ...(turn.phase === "settled"
          ? { tokens: { input, output, total: input + output } }
          : {}),
      })
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(record),
  GroupImpl.finalize
);
