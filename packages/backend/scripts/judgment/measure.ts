import { noteText } from "@repo/backend/confect/nina/judgment/ask";
import { JudgmentName } from "@repo/backend/confect/nina/judgment/catalog";
import {
  MEASURE_TEXT_LIMIT,
  type Measurement,
} from "@repo/backend/confect/nina/judgment.spec";
import { MEMORY_CAPTURE_LIMIT } from "@repo/backend/confect/nina/memory.spec";
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
import { messages } from "@repo/backend/test/judgment/message";
import { notes } from "@repo/backend/test/judgment/note";
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

/** The flag that sets how many notes share one request. */
const TOGETHER_FLAG = "--together=";

/** How many notes share one request: a whole number from 1 to the most one capture proposes. */
const Together = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isBetween({ maximum: MEMORY_CAPTURE_LIMIT, minimum: 1 })
);

/**
 * How many notes share one request: one, unless `--together=N` says otherwise.
 * The capture asks about up to three candidates of a turn together, and this
 * measures that. A message is always asked alone, as the capture asks.
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
                message: `${TOGETHER_FLAG}N takes a whole number from 1 to ${MEMORY_CAPTURE_LIMIT}.`,
              })
          )
        ),
    }
  );
});

/**
 * A labelled text as it is sent: the text itself, the label each judgment
 * asked about it should give, by the name of the judgment, and what describes
 * it in a report without quoting it.
 */
const Item = Schema.Struct({
  form: Schema.optionalKey(Schema.String),
  labels: Schema.Record(Schema.String, Schema.Boolean),
  languages: Schema.String,
  text: Schema.String,
});

/**
 * A kind of text and the judgments asked about it, as production asks them: a
 * whole message is asked alone about `lasting`, and the notes of a turn are
 * asked together about `ownNote` and `private`, in one request for all of them.
 * `noun` names what the texts are in a report.
 */
const Shape = Schema.Struct({
  items: Schema.NonEmptyArray(Item),
  names: Schema.NonEmptyArray(JudgmentName),
  noun: Schema.String,
  together: Schema.Int,
});

/** The kinds of text the labelled set holds, with the judgments asked about each. */
function shapesOf(together: number): readonly (typeof Shape.Type)[] {
  return [
    {
      items: Arr.map(messages, ({ form, languages, lasting, text }) => ({
        ...(form === undefined ? {} : { form }),
        labels: { lasting },
        languages,
        text,
      })),
      names: ["lasting"],
      noun: "message",
      together: 1,
    },
    {
      items: Arr.map(notes, (note) => ({
        ...(note.form === undefined ? {} : { form: note.form }),
        labels: { ownNote: note.ownNote, private: note.private },
        languages: note.languages,
        text: noteText(note),
      })),
      names: ["ownNote", "private"],
      noun: "note",
      together,
    },
  ];
}

/** The point of one text for one judgment, when the deployment measured that judgment for it. */
function pointOf(
  name: JudgmentName,
  index: number,
  item: typeof Item.Type,
  measured: Measured
) {
  return Option.flatMap(
    Predicate.hasProperty(measured, "probabilities")
      ? Rec.get(measured.probabilities, name)
      : Option.none(),
    (probability) =>
      Option.map(
        Rec.get(item.labels, name),
        (label): Point => ({
          ...(item.form === undefined ? {} : { form: item.form }),
          label,
          languages: item.languages,
          probability,
          row: index + 1,
        })
      )
  );
}

/** The routing facts of a text the deployment could not measure, when it could not. */
function failureOf(measured: Measured): readonly Failure[] {
  return Predicate.hasProperty(measured, "failure") ? [measured.failure] : [];
}

/** The threshold the deployment holds for a judgment, or the failure that names the judgment when it reports none. */
function thresholdOf(
  name: JudgmentName,
  thresholds: (typeof Measurement.Type)["thresholds"]
) {
  return Effect.fromOption(Rec.get(thresholds, name)).pipe(
    Effect.mapError(
      () =>
        new JudgmentCallError({
          message: `The deployment reports no threshold for the judgment ${name}.`,
        })
    )
  );
}

/**
 * Sends the texts of one shape to the deployment, whole groups to a call, and
 * writes one table for each judgment asked about them. The thresholds in the
 * tables are the ones the deployment reports, and a judgment it reports none
 * for is a failure.
 */
const measureShape = Effect.fn("judgment.measureShape")(function* (
  config: Parameters<typeof callMeasure>[0],
  { items, names, noun, together }: typeof Shape.Type
) {
  // A call holds whole groups, so that a group never straddles two calls.
  const size = Math.floor(MEASURE_TEXT_LIMIT / together) * together;
  const measurements = yield* Effect.forEach(
    Arr.chunksOf(
      Arr.map(items, ({ text }) => text),
      size
    ),
    (texts) => callMeasure(config, names, texts, together)
  );
  const rows = Arr.flatMap(measurements, (measurement) => measurement.rows);
  // Every call reads the same deployment, so every call reports the same thresholds.
  const { thresholds } = Arr.headNonEmpty(measurements);
  const tables = yield* Effect.forEach(names, (name) =>
    Effect.map(thresholdOf(name, thresholds), (threshold) =>
      judgmentTable(
        name,
        noun,
        threshold,
        Arr.getSomes(
          Arr.map(Arr.zip(items, rows), ([item, measured], index) =>
            pointOf(name, index, item, measured)
          )
        )
      )
    )
  );
  return { failures: Arr.flatMap(rows, failureOf), tables };
});

/**
 * Runs the labelled set through the deployment `prod` names, development unless
 * `prod` is true, and writes one table for each judgment: the probabilities by
 * label, the counts at the threshold the deployment holds, and the threshold
 * that separates best. Each judgment is measured on the form of text and the
 * grouping that production asks it: `lasting` on a whole message alone, and
 * `ownNote` and `private` on a note, the sentence with its quote, `together`
 * notes to a request. It answers with that report and the number of texts the
 * deployment could not measure. A text is named by its number among the
 * messages or the notes, and never quoted.
 */
export const measureSet = Effect.fn("judgment.measureSet")(function* (
  prod: boolean,
  together: number
) {
  const config = yield* getCustomerConvexConfig(prod);
  const measured = yield* Effect.forEach(shapesOf(together), (shape) =>
    measureShape(config, shape)
  );
  const failures = Arr.flatMap(measured, (shape) => shape.failures);
  return {
    failed: Arr.length(failures),
    report: Arr.join(
      [
        `${Arr.length(messages)} messages, one to a request, and ${Arr.length(notes)} notes, ${together} to a request, measured on ${prod ? "production" : "the development deployment"}.`,
        ...Arr.flatMap(measured, (shape) => shape.tables),
        ...(Arr.isReadonlyArrayNonEmpty(failures)
          ? [failureLine(failures)]
          : []),
      ],
      "\n\n"
    ),
  };
});
