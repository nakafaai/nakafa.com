import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { BLUEPRINT_PLAN, LoadPlan } from "@repo/backend/scripts/load/plan";
import { recorderLayer } from "@repo/backend/scripts/load/recorder";
import { LoadReport } from "@repo/backend/scripts/load/report";
import { runLoad } from "@repo/backend/scripts/load/run";
import { fakeServer } from "@repo/backend/test/load";
import { Array as Arr, Effect, FileSystem, Schema } from "effect";

const encodeJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** A plan of one student and one proctor that answers the fake exam's four questions in a moment. */
const plan = LoadPlan.make({
  ...BLUEPRINT_PLAN,
  changeShare: 0,
  disconnectShare: 0,
  entrySeconds: 0,
  minutes: 0.001,
  proctors: 1,
  questions: 4,
  rooms: 1,
  secondTabShare: 0,
  students: 1,
});

describe("load run", () => {
  it.live(
    "seeds the school, runs every student and proctor, audits the stored answers, and writes the report",
    () =>
      Effect.gen(function* () {
        const fake = fakeServer();
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        const output = `${directory}/report.json`;
        const report = yield* runLoad({
          capture: (path) =>
            fs.writeFileString(
              path,
              encodeJson({
                executionTime: 0.01,
                identifier: "exams/sittings.js:answer",
                kind: "Completion",
                udfType: "Mutation",
                usageStats: { databaseReadDocuments: 14 },
              })
            ),
          connect: () => fake.open,
          output,
          plan,
          run: (_operation, args) =>
            Effect.sync(() => {
              if (args[1] === "exams/seed:load") {
                return encodeJson({
                  examId: "e1",
                  sittings: [{ id: "s1", room: "Ruang 01", token: "AAAAAA" }],
                });
              }
              if (args[0] === "data") {
                return encodeJson([
                  ...Arr.map(
                    Arr.fromIterable(fake.saved),
                    ([question, saved]) => ({
                      attempt: "a1",
                      question,
                      response: saved.response,
                      version: saved.version,
                    })
                  ),
                  {
                    attempt: "other",
                    question: "q1",
                    response: [],
                    version: 1,
                  },
                ]);
              }
              return "";
            }),
          school: () => Effect.succeed("sekolah"),
        }).pipe(Effect.provide(recorderLayer));
        expect(report.audit).toMatchObject({
          acknowledged: 4,
          lost: 0,
          stored: 4,
        });
        expect(report.client["mutation:answer"]?.count).toBe(4);
        expect(report.client["query:dashboard"]?.count).toBe(1);
        expect(report.server["mutation:exams/sittings:answer"]?.count).toBe(1);
        expect(report.client["driver:lag"]?.count).toBeGreaterThan(0);
        expect(report.reads["mutation:exams/sittings:answer"]?.p50).toBe(14);
        expect(report.conflicts).toEqual({});
        expect(report.passed).toBe(true);
        const written = yield* fs
          .readFileString(output)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(LoadReport))
            )
          );
        expect(written.audit).toEqual(report.audit);
        expect(yield* fs.readFileString(`${output}.md`)).toContain(
          "Verdict: pass."
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer)),
    30_000
  );
});
