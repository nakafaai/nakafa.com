import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/nina/usage.spec";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** Adds a call's amount to its row's total; an amount no call has reported stays absent. */
function add(total: number | undefined, amount: number | undefined) {
  if (total === undefined && amount === undefined) {
    return;
  }
  return (total ?? 0) + (amount ?? 0);
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
      const cost = add(previous.cost, usage.cost);
      const cached = add(previous.cached, usage.cached);
      const reasoning = add(previous.reasoning, usage.reasoning);
      totals[index] = {
        ...usage,
        input: previous.input + usage.input,
        output: previous.output + usage.output,
        calls: previous.calls + 1,
        ...(cost === undefined ? {} : { cost }),
        ...(cached === undefined ? {} : { cached }),
        ...(reasoning === undefined ? {} : { reasoning }),
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
