import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { StudentScript } from "@repo/backend/scripts/load/plan";
import { Recorder, recorderLayer } from "@repo/backend/scripts/load/recorder";
import { runStudent } from "@repo/backend/scripts/load/student";
import { fakeServer } from "@repo/backend/test/load";
import { Array as Arr, Clock, Effect, MutableHashMap, Schema } from "effect";

const seating = {
  sittingId: "s1",
  slug: Schema.decodeSync(TenantSlug)("sekolah"),
  token: "K7Q4XM",
};

/** A script of one answer per question, a few milliseconds apart, with no cut and no second tab. */
const script = (fields: Partial<StudentScript> = {}): StudentScript => ({
  cut: null,
  enterAt: 0,
  index: 0,
  room: 0,
  secondTab: false,
  steps: [
    { at: 1, question: 0 },
    { at: 2, question: 1 },
    { at: 3, question: 0 },
    { at: 4, question: 2 },
  ],
  ...fields,
});

/** The names of the calls the server took, in order. */
const names = (server: ReturnType<typeof fakeServer>) =>
  Arr.map(server.calls, (call) => call.name);

/** Runs one student against the server from now, and returns what the recorder holds. */
const run = (
  server: ReturnType<typeof fakeServer>,
  studentScript: StudentScript
) =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis;
    const exit = yield* Effect.exit(
      runStudent({ open: server.open, script: studentScript, seating, start })
    );
    const recorder = yield* Recorder;
    return {
      acknowledged: yield* recorder.acknowledged,
      exit,
      samples: yield* recorder.samples,
    };
  }).pipe(Effect.provide(recorderLayer));

describe("load student", () => {
  it.live(
    "enters with the token, answers each step one version above the last, and finishes",
    () =>
      Effect.gen(function* () {
        const server = fakeServer();
        const result = yield* run(server, script());
        expect(result.exit._tag).toBe("Success");
        expect(names(server)).toEqual([
          "exams/sittings:enter",
          "exams/screens:look",
          "exams/sittings:answer",
          "exams/screens:look",
          "exams/sittings:answer",
          "exams/screens:look",
          "exams/sittings:answer",
          "exams/screens:look",
          "exams/sittings:answer",
          "exams/sittings:finish",
        ]);
        expect(server.calls[0]?.args).toMatchObject({
          sittingId: "s1",
          slug: "sekolah",
          token: "K7Q4XM",
        });
        expect(
          Arr.map(result.acknowledged, (answer) => [
            answer.question,
            answer.version,
          ])
        ).toEqual([
          ["q1", 1],
          ["q2", 1],
          ["q1", 2],
          ["q3", 1],
        ]);
        expect(MutableHashMap.size(server.saved)).toBe(3);
        expect(
          Arr.dedupe(Arr.map(result.samples, (sample) => sample.name))
        ).toEqual([
          "query:student",
          "mutation:enter",
          "query:paper",
          "query:prompt",
          "mutation:look",
          "mutation:answer",
          "mutation:finish",
        ]);
        expect(Arr.every(result.samples, (sample) => !sample.failed)).toBe(
          true
        );
      })
  );

  it.live("stops a student whose entry the sitting refuses", () =>
    Effect.gen(function* () {
      const server = fakeServer({ refuse: true });
      const result = yield* run(server, script());
      expect(result.exit._tag).toBe("Failure");
      expect(names(server)).toEqual(["exams/sittings:enter"]);
      expect(result.acknowledged).toEqual([]);
    })
  );

  it.live(
    "keeps the answers chosen while cut off, and sends them in order once a new tab enters again",
    () =>
      Effect.gen(function* () {
        const server = fakeServer();
        const result = yield* run(
          server,
          script({ cut: { afterStep: 0, lasts: 20 } })
        );
        expect(result.exit._tag).toBe("Success");
        expect(
          Arr.filter(names(server), (name) => name === "exams/sittings:enter")
        ).toHaveLength(2);
        expect(
          Arr.map(result.acknowledged, (answer) => [
            answer.question,
            answer.version,
          ])
        ).toEqual([
          ["q1", 1],
          ["q2", 1],
          ["q1", 2],
          ["q3", 1],
        ]);
        expect(
          Arr.some(result.samples, (sample) => sample.name === "sync:reconnect")
        ).toBe(true);
        expect(names(server).at(-1)).toBe("exams/sittings:finish");
      })
  );

  it.live("goes on after a cut whose steps all come after it is back", () =>
    Effect.gen(function* () {
      const server = fakeServer();
      const result = yield* run(
        server,
        script({
          cut: { afterStep: 0, lasts: 1 },
          steps: [
            { at: 1, question: 0 },
            { at: 40, question: 1 },
          ],
        })
      );
      expect(result.exit._tag).toBe("Success");
      expect(Arr.map(result.acknowledged, (answer) => answer.question)).toEqual(
        ["q1", "q2"]
      );
    })
  );

  it.live(
    "opens a second tab from the same device halfway, which signals it and changes the first answer",
    () =>
      Effect.gen(function* () {
        const server = fakeServer();
        const result = yield* run(
          server,
          script({
            secondTab: true,
            steps: [
              { at: 1, question: 0 },
              { at: 60, question: 1 },
            ],
          })
        );
        expect(result.exit._tag).toBe("Success");
        const signal = Arr.findFirst(
          server.calls,
          (call) => call.name === "exams/sittings:signal"
        );
        expect(signal._tag === "Some" && signal.value.args.kind).toBe(
          "secondTab"
        );
        const enters = Arr.filter(
          server.calls,
          (call) => call.name === "exams/sittings:enter"
        );
        expect(enters[1]?.args.deviceId).toBe(enters[0]?.args.deviceId);
        expect(
          Arr.map(result.acknowledged, (answer) => [
            answer.question,
            answer.version,
          ])
        ).toEqual([
          ["q1", 1],
          ["q1", 2],
          ["q2", 1],
        ]);
      })
  );

  it.live(
    "records a refused answer as failed and does not count it as acknowledged",
    () =>
      Effect.gen(function* () {
        const server = fakeServer({ stale: true });
        const result = yield* run(
          server,
          script({ steps: [{ at: 1, question: 0 }] })
        );
        expect(result.exit._tag).toBe("Success");
        expect(result.acknowledged).toEqual([]);
        expect(
          Arr.filter(
            result.samples,
            (sample) => sample.name === "mutation:answer"
          )
        ).toEqual([
          { failed: true, ms: expect.any(Number), name: "mutation:answer" },
        ]);
      })
  );

  it.live("finishes a student with no step, whose second tab never opens", () =>
    Effect.gen(function* () {
      const server = fakeServer();
      const result = yield* run(server, script({ secondTab: true, steps: [] }));
      expect(result.exit._tag).toBe("Success");
      expect(names(server).at(-1)).toBe("exams/sittings:finish");
    })
  );
});
