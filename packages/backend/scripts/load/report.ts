import { Audit } from "@repo/backend/scripts/load/ledger";
import { LoadPlan } from "@repo/backend/scripts/load/plan";
import { Latency } from "@repo/backend/scripts/load/stats";
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

/** What one run measured: its plan, its length, every call's latency on both ends, and the audit. */
export const LoadReport = Schema.Struct({
  audit: Audit,
  client: Schema.Record(Schema.String, Latency),
  endedAt: Schema.Finite,
  passed: Schema.Boolean,
  plan: LoadPlan,
  server: Schema.Record(Schema.String, Latency),
  startedAt: Schema.Finite,
});
export type LoadReport = typeof LoadReport.Type;

/** The 95th percentile of one kind of call, none when the run made no such call. */
const p95Of = (
  latencies: Record.ReadonlyRecord<string, Latency>,
  name: string
) => Option.map(Record.get(latencies, name), (latency) => latency.p95);

/** Whether a run met every target: each latency under its target, and no answer lost, duplicated or changed. */
export const passes = (
  client: Record.ReadonlyRecord<string, Latency>,
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

/** One whole number of milliseconds, as the tables print it. */
const ms = (value: number) => String(Math.round(value));

/** A table of latencies by call, sorted by the call's name. */
const latencyTable = (latencies: Record.ReadonlyRecord<string, Latency>) =>
  pipe(
    Record.toEntries(latencies),
    Arr.sort(
      Order.mapInput(Order.String, ([name]: readonly [string, Latency]) => name)
    ),
    Arr.map(
      ([name, latency]) =>
        `| ${name} | ${latency.count} | ${latency.failed} | ${ms(latency.p50)} | ${ms(latency.p95)} | ${ms(latency.p99)} | ${ms(latency.max)} |`
    ),
    (rows) =>
      Arr.join(
        [
          "| Call | Count | Failed | p50 ms | p95 ms | p99 ms | Max ms |",
          "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
          ...rows,
        ],
        "\n"
      )
  );

/** The report as Markdown: the verdict, the client and server latency tables, and the audit. */
export const markdownOf = (report: LoadReport) =>
  Arr.join(
    [
      `Verdict: ${report.passed ? "pass" : "fail"}. ${report.plan.students} students in ${report.plan.rooms} rooms, ${report.plan.questions} questions in ${report.plan.minutes} minutes, ${Math.round((report.endedAt - report.startedAt) / 1000)} s.`,
      "",
      "Client, as each student and proctor waited:",
      "",
      latencyTable(report.client),
      "",
      "Server, as the backend ran each function:",
      "",
      latencyTable(report.server),
      "",
      "| Answers | Acknowledged | Stored | Lost | Duplicated | Mismatched | Ahead | Unacknowledged |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      `| Audit | ${report.audit.acknowledged} | ${report.audit.stored} | ${report.audit.lost} | ${report.audit.duplicated} | ${report.audit.mismatched} | ${report.audit.ahead} | ${report.audit.unacknowledged} |`,
    ],
    "\n"
  );
