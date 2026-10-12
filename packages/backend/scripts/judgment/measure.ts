import { JudgmentName } from "@repo/backend/confect/nina/judgment/catalog";
import { noteText } from "@repo/backend/confect/nina/judgment/note";
import {
  MEASURE_TEXT_LIMIT,
  type Measurement,
} from "@repo/backend/confect/nina/judgment.spec";
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
  Equal,
  Option,
  Predicate,
  Record as Rec,
  Schema,
} from "effect";

type Measured = (typeof Measurement.Type)["rows"][number];

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
 * whole message is asked about `lasting`, and a note, which is the sentence the
 * capture model proposes with its quote, about `ownNote` and `private` in the
 * same request. Every text is a request of its own. `noun` names what the texts
 * are in a report.
 */
const Shape = Schema.Struct({
  items: Schema.NonEmptyArray(Item),
  names: Schema.mutable(Schema.NonEmptyArray(JudgmentName)),
  noun: Schema.String,
});

/** The kinds of text the labelled set holds, with the judgments asked about each. */
const shapes: readonly (typeof Shape.Type)[] = [
  {
    items: Arr.map(messages, ({ form, languages, lasting, text }) => ({
      ...(form === undefined ? {} : { form }),
      labels: { lasting },
      languages,
      text,
    })),
    names: ["lasting"],
    noun: "message",
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
  },
];

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

/**
 * The threshold the deployment holds for a judgment, which every call of the
 * run has to report with the same instructions. A call that reports none, or
 * another entry than the first call did, fails with an error that names the
 * judgment: the deployment changed while the command ran, and the table would
 * mix two versions of the judgment.
 */
const thresholdOf = Effect.fn("judgment.thresholdOf")(function* (
  name: JudgmentName,
  measurements: Arr.NonEmptyReadonlyArray<typeof Measurement.Type>
) {
  const entries = Arr.map(measurements, ({ judgments }) =>
    Rec.get(judgments, name)
  );
  const [first] = entries;
  if (Option.isNone(first)) {
    return yield* new JudgmentCallError({
      message: `The deployment reports no threshold for the judgment ${name}.`,
    });
  }
  if (!Arr.every(entries, Equal.equals(first))) {
    return yield* new JudgmentCallError({
      message: `The deployment answered with a different ${name} in two calls of one run, so it changed while the command ran. Run the command again.`,
    });
  }
  return first.value.threshold;
});

/**
 * Sends the texts of one shape to the deployment, up to `MEASURE_TEXT_LIMIT`
 * to a call, and writes one table for each judgment asked about them. A shape
 * with more texts goes up in several calls, one after another. The thresholds in
 * the tables are the ones the deployment reports, the same in every call.
 */
const measureShape = Effect.fn("judgment.measureShape")(function* ({
  items,
  names,
  noun,
}: typeof Shape.Type) {
  const measurements = yield* Effect.forEach(
    Arr.chunksOf(
      Arr.map(items, ({ text }) => text),
      MEASURE_TEXT_LIMIT
    ),
    (texts) => callMeasure({ names, texts })
  );
  const rows = Arr.flatMap(measurements, (measurement) => measurement.rows);
  const tables = yield* Effect.forEach(names, (name) =>
    Effect.map(thresholdOf(name, measurements), (threshold) =>
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
 * Runs the labelled set through the dev deployment that the Convex CLI of the
 * caller reaches (`ConvexCli`), and writes one table for each judgment: the
 * probabilities by label, the counts at the threshold the deployment holds, and
 * the threshold that separates best. Each judgment is measured on the form of
 * text that production asks it, and every text is a request of its own:
 * `lasting` on a whole message, and `ownNote` and `private` on a note, the
 * sentence with its quote. It answers with that report and the number of texts
 * the deployment could not measure. The report names a text by its number among
 * the messages or the notes and describes it by its language and form, and
 * never quotes it. Its caller has to check that the CLI goes to a dev
 * deployment (`requireDevelopment`) before this runs.
 */
export const measureSet = Effect.fn("judgment.measureSet")(function* () {
  const measured = yield* Effect.forEach(shapes, measureShape);
  const failures = Arr.flatMap(measured, (shape) => shape.failures);
  return {
    failed: Arr.length(failures),
    report: Arr.join(
      [
        `${Arr.length(messages)} messages and ${Arr.length(notes)} notes, one text to a request, measured on the development deployment.`,
        ...Arr.flatMap(measured, (shape) => shape.tables),
        ...(Arr.isReadonlyArrayNonEmpty(failures)
          ? [failureLine(failures)]
          : []),
      ],
      "\n\n"
    ),
  };
});
