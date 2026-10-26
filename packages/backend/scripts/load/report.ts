import { Audit } from "@repo/backend/scripts/load/ledger";
import { LoadPlan } from "@repo/backend/scripts/load/plan";
import { Spread } from "@repo/backend/scripts/load/stats";
import { Array as Arr, Option, Order, pipe, Record, Schema } from "effect";

/**
 * The targets of the blueprint's load test (Mutu, K26), in milliseconds at the 95th percentile:
 * an answer write as the student waits for it, a start and a finish of an attempt, and the resync
 * of the answers a cut-off student kept once the connection is back.
 */
export const TARGETS = {
  answer: 150,
  enter: 300,
  finish: 300,
  sync: 5000,
} as const;

/**
 * What one run measured: its plan and length, every call's latency on both ends, the documents
 * each function read, the write conflicts the backend retried, and the audit of the answers.
 */
export const LoadReport = Schema.Struct({
  audit: Audit,
  client: Schema.Record(Schema.String, Spread),
  conflicts: Schema.Record(Schema.String, Spread),
  endedAt: Schema.Finite,
  passed: Schema.Boolean,
  plan: LoadPlan,
  reads: Schema.Record(Schema.String, Spread),
  server: Schema.Record(Schema.String, Spread),
  startedAt: Schema.Finite,
});
export type LoadReport = typeof LoadReport.Type;

/** The 95th percentile of one kind of call, none when the run made no such call. */
const p95Of = (
  latencies: Record.ReadonlyRecord<string, Spread>,
  name: string
) => Option.map(Record.get(latencies, name), (latency) => latency.p95);

/** Whether a run met every target: each latency under its target, and no answer lost, duplicated or changed. */
export const passes = (
  client: Record.ReadonlyRecord<string, Spread>,
  audit: Audit
) =>
  Arr.every(
    [
      ["mutation:answer", TARGETS.answer],
      ["mutation:enter", TARGETS.enter],
      ["mutation:finish", TARGETS.finish],
    ] as const,
    ([name, target]) =>
      Option.exists(p95Of(client, name), (p95) => p95 < target)
  ) &&
  Option.getOrElse(
    Option.map(p95Of(client, "sync:reconnect"), (p95) => p95 < TARGETS.sync),
    () => true
  ) &&
  audit.lost === 0 &&
  audit.duplicated === 0 &&
  audit.mismatched === 0;

/** One whole number, as the tables print every measure. */
const whole = (value: number) => String(Math.round(value));

/** A table of spreads by call in `unit`, sorted by the call's name. */
const spreadTable = (
  spreads: Record.ReadonlyRecord<string, Spread>,
  unit: string
) =>
  pipe(
    Record.toEntries(spreads),
    Arr.sort(
      Order.mapInput(Order.String, ([name]: readonly [string, Spread]) => name)
    ),
    Arr.map(
      ([name, spread]) =>
        `| ${name} | ${spread.count} | ${spread.failed} | ${whole(spread.p50)} | ${whole(spread.p95)} | ${whole(spread.p99)} | ${whole(spread.max)} |`
    ),
    (rows) =>
      Arr.join(
        [
          `| Call | Count | Failed | p50 ${unit} | p95 ${unit} | p99 ${unit} | Max ${unit} |`,
          "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
          ...rows,
        ],
        "\n"
      )
  );

/** The write conflicts by function and table, or a sentence that the backend retried none. */
const conflictLines = (conflicts: Record.ReadonlyRecord<string, Spread>) =>
  Record.isEmptyRecord(conflicts)
    ? ["The backend retried no write after a conflict."]
    : [
        "| Conflict | Retries |",
        "| --- | ---: |",
        ...Arr.map(
          Arr.sort(
            Record.toEntries(conflicts),
            Order.mapInput(
              Order.String,
              ([name]: readonly [string, Spread]) => name
            )
          ),
          ([name, spread]) => `| ${name} | ${spread.count} |`
        ),
      ];

/** The report as Markdown: the verdict, the client and server latencies, the reads, the conflicts, and the audit. */
export const markdownOf = (report: LoadReport) =>
  Arr.join(
    [
      `Verdict: ${report.passed ? "pass" : "fail"}. ${report.plan.students} students in ${report.plan.rooms} rooms, ${report.plan.questions} questions in ${report.plan.minutes} minutes, ${Math.round((report.endedAt - report.startedAt) / 1000)} s.`,
      "",
      "Client, as each student and proctor waited:",
      "",
      spreadTable(report.client, "ms"),
      "",
      "Server, as the backend ran each function:",
      "",
      spreadTable(report.server, "ms"),
      "",
      "Documents each function read:",
      "",
      spreadTable(report.reads, "docs"),
      "",
      ...conflictLines(report.conflicts),
      "",
      "| Answers | Acknowledged | Stored | Lost | Duplicated | Mismatched | Ahead | Unacknowledged |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      `| Audit | ${report.audit.acknowledged} | ${report.audit.stored} | ${report.audit.lost} | ${report.audit.duplicated} | ${report.audit.mismatched} | ${report.audit.ahead} | ${report.audit.unacknowledged} |`,
    ],
    "\n"
  );
