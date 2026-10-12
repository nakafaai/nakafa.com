import {
  CHAT_AGENT,
  type ChatStep,
  elapsedMillis,
  type GateTurn,
} from "@repo/backend/scripts/nina/verdict";
import { Array as Arr, Option, Predicate, Schema, String as Str } from "effect";

/** One printed line of the table: an agent's row of the usage record, or the total. */
const Line = Schema.Struct({
  agent: Schema.String,
  cached: Schema.Finite,
  cost: Schema.UndefinedOr(Schema.Finite),
  input: Schema.Finite,
  output: Schema.Finite,
  reasoning: Schema.Finite,
  seconds: Schema.UndefinedOr(Schema.Finite),
  steps: Schema.Finite,
});
type Line = typeof Line.Type;

/** The table's columns: a header, a side to align on, and the text of each line. */
const COLUMNS = [
  { cell: (line: Line) => line.agent, header: "agent", left: true },
  { cell: (line: Line) => String(line.steps), header: "steps", left: false },
  { cell: (line: Line) => String(line.input), header: "input", left: false },
  { cell: (line: Line) => String(line.cached), header: "cached", left: false },
  { cell: (line: Line) => String(line.output), header: "output", left: false },
  {
    cell: (line: Line) => String(line.reasoning),
    header: "reasoning",
    left: false,
  },
  {
    cell: (line: Line) =>
      line.cost === undefined ? "-" : line.cost.toFixed(6),
    header: "cost",
    left: false,
  },
  {
    cell: (line: Line) =>
      line.seconds === undefined ? "" : line.seconds.toFixed(1),
    header: "seconds",
    left: false,
  },
];

/** The sum of one number over rows. */
function sum<Row>(rows: readonly Row[], pick: (row: Row) => number) {
  return Arr.reduce(rows, 0, (total, row) => total + pick(row));
}

/** The line of one agent's row. A row stored before the ledger recorded cached and reasoning tokens lacks them. */
function lineOf(row: GateTurn["usage"][number]): Line {
  return {
    agent: row.agent,
    cached: row.cached ?? 0,
    cost: row.cost,
    input: row.input,
    output: row.output,
    reasoning: row.reasoning ?? 0,
    seconds: undefined,
    steps: row.calls,
  };
}

/** The line that adds up every row and holds the time of the whole turn. */
function totalOf(turn: GateTurn, lines: readonly Line[]): Line {
  const costs = Arr.filter(
    Arr.map(lines, (line) => line.cost),
    Predicate.isNotUndefined
  );
  return {
    agent: "total",
    cached: sum(lines, (line) => line.cached),
    cost: Arr.isReadonlyArrayNonEmpty(costs)
      ? sum(costs, (cost) => cost)
      : undefined,
    input: sum(lines, (line) => line.input),
    output: sum(lines, (line) => line.output),
    reasoning: sum(lines, (line) => line.reasoning),
    seconds: Option.getOrUndefined(
      Option.map(elapsedMillis(turn), (elapsed) => elapsed / 1000)
    ),
    steps: sum(lines, (line) => line.steps),
  };
}

/**
 * The line under the table that shows the cache step by step: the input tokens
 * of each chat step that the provider read from its cache. A first step that
 * already read the cache means an earlier turn with the same prompt prefix
 * warmed it, so the later reads do not prove that this turn wrote it.
 */
function describeSteps(steps: readonly ChatStep[]) {
  if (Arr.isReadonlyArrayEmpty(steps)) {
    return `The Agent journal holds no step of the ${CHAT_AGENT} agent.`;
  }
  const line = `Cached of input tokens, by ${CHAT_AGENT} step: ${Arr.join(
    Arr.map(steps, (step) => `${step.cached} of ${step.input}`),
    ", "
  )}.`;
  return Arr.some(Arr.take(steps, 1), (step) => step.cached > 0)
    ? `${line} The first step already read the cache, so a turn before this one with the same prompt prefix warmed it. Run the gate again after five minutes to see the turn's own cache.`
    : line;
}

/**
 * The table of a stored turn: steps, input, cached, output, reasoning, cost
 * and seconds, one row for each agent of the usage record and a total, with a
 * line under it for the cache of each chat step. Cost is in US dollars. It
 * holds no message text.
 */
export function renderTable(turn: GateTurn, steps: readonly ChatStep[]) {
  const lines = Arr.map(turn.usage, lineOf);
  const shown = Arr.append(lines, totalOf(turn, lines));
  const sized = Arr.map(COLUMNS, (column) => ({
    column,
    width: Arr.reduce(shown, column.header.length, (width, line) =>
      Math.max(width, column.cell(line).length)
    ),
  }));
  const format = (cell: (column: (typeof COLUMNS)[number]) => string) =>
    Str.trimEnd(
      Arr.join(
        Arr.map(sized, ({ column, width }) =>
          column.left
            ? Str.padEnd(width)(cell(column))
            : Str.padStart(width)(cell(column))
        ),
        "  "
      )
    );
  return Arr.join(
    [
      format((column) => column.header),
      ...Arr.map(shown, (line) => format((column) => column.cell(line))),
      "",
      describeSteps(steps),
    ],
    "\n"
  );
}
