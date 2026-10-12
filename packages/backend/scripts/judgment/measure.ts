import {
  type JudgmentName,
  judgments,
} from "@repo/backend/confect/nina/judgment/catalog";
import {
  MEASURE_TEXT_LIMIT,
  MEASURE_TOGETHER_LIMIT,
  type Measurement,
} from "@repo/backend/confect/nina/judgment.spec";
import { getCustomerConvexConfig } from "@repo/backend/scripts/customers/convex";
import {
  callMeasure,
  JudgmentCallError,
} from "@repo/backend/scripts/judgment/call";
import {
  type Failure,
  failureLine,
  judgmentTable,
  type Point,
} from "@repo/backend/scripts/judgment/report";
import { labelledSet } from "@repo/backend/test/judgment/set";
import {
  Array as Arr,
  Effect,
  Option,
  Predicate,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";

type Measured = (typeof Measurement.Type)["rows"][number];

/** The flag that sets how many messages share one request. */
const TOGETHER_FLAG = "--together=";

/** How many messages share one request: a whole number from 1 to the most the action allows. */
const Together = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isBetween({ maximum: MEASURE_TOGETHER_LIMIT, minimum: 1 })
);

/**
 * How many messages share one request: one, as the capture asks about a
 * message, unless `--together=N` says otherwise. The capture asks about up to
 * three candidates together, and this measures that.
 */
export const togetherOf = Effect.fn("judgment.together")(function* (
  args: readonly string[]
) {
  return yield* Option.match(
    Arr.findFirst(args, Str.startsWith(TOGETHER_FLAG)),
    {
      onNone: () => Effect.succeed(1),
      onSome: (flag) =>
        Schema.decodeEffect(Together)(
          Str.slice(Str.length(TOGETHER_FLAG))(flag)
        ).pipe(
          Effect.mapError(
            () =>
              new JudgmentCallError({
                message: `${TOGETHER_FLAG}N takes a whole number from 1 to ${MEASURE_TOGETHER_LIMIT}.`,
              })
          )
        ),
    }
  );
});

/** The point of one message for one judgment, when the deployment measured that judgment for it. */
function pointOf(
  name: JudgmentName,
  index: number,
  message: (typeof labelledSet)[number],
  measured: Measured
) {
  return Predicate.hasProperty(measured, "probabilities")
    ? Option.map(
        Rec.get(measured.probabilities, name),
        (probability): Point => ({
          ...(message.form === undefined ? {} : { form: message.form }),
          label: message[name],
          languages: message.languages,
          probability,
          row: index + 1,
        })
      )
    : Option.none<Point>();
}

/** The routing facts of a message the deployment could not measure, when it could not. */
function failureOf(measured: Measured): readonly Failure[] {
  return Predicate.hasProperty(measured, "failure") ? [measured.failure] : [];
}

/**
 * Runs the labelled set through the deployment `prod` names, development unless
 * `prod` is true, and writes one table for each judgment: the probabilities by
 * label, the counts at the threshold the deployment holds, and the threshold
 * that separates best. It answers with that report and the number of messages
 * the deployment could not measure. A message is named by its number in the
 * set, and never quoted.
 */
export const measureSet = Effect.fn("judgment.measureSet")(function* (
  prod: boolean,
  together: number
) {
  const config = yield* getCustomerConvexConfig(prod);
  // A call holds whole groups, so that a group never straddles two calls.
  const size = Math.floor(MEASURE_TEXT_LIMIT / together) * together;
  const measurements = yield* Effect.forEach(
    Arr.chunksOf(
      Arr.map(labelledSet, ({ text }) => text),
      size
    ),
    (texts) => callMeasure(config, texts, together)
  );
  const rows = Arr.flatMap(measurements, (measurement) => measurement.rows);
  // Every call reads the same deployment, so every call reports the same thresholds.
  const { thresholds } = Arr.headNonEmpty(measurements);
  const tables = Arr.map(Rec.keys(judgments), (name) =>
    judgmentTable(
      name,
      Option.getOrElse(
        Rec.get(thresholds, name),
        () => judgments[name].threshold
      ),
      Arr.getSomes(
        Arr.map(Arr.zip(labelledSet, rows), ([message, measured], index) =>
          pointOf(name, index, message, measured)
        )
      )
    )
  );
  const failures = Arr.flatMap(rows, failureOf);
  return {
    failed: Arr.length(failures),
    report: Arr.join(
      [
        `${Arr.length(rows)} messages measured on ${prod ? "production" : "the development deployment"}, ${together} to a request.`,
        ...tables,
        ...(Arr.isReadonlyArrayNonEmpty(failures)
          ? [failureLine(failures)]
          : []),
      ],
      "\n\n"
    ),
  };
});
