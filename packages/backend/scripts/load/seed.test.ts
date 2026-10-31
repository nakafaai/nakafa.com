import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { BLUEPRINT_PLAN, LoadPlan } from "@repo/backend/scripts/load/plan";
import { seedRun } from "@repo/backend/scripts/load/seed";
import { Array as Arr, Effect, MutableList, Schema } from "effect";

/** The arguments of one seats call, as the Convex CLI receives them. */
const SeatsArgs = Schema.fromJsonString(
  Schema.Struct({
    kind: Schema.String,
    seats: Schema.Array(
      Schema.Struct({
        key: Schema.String,
        name: Schema.String,
        token: Schema.String,
      })
    ),
    slug: Schema.String,
  })
);

/** One call of the Convex CLI that the seed made, with the values it keeps secret. */
const Call = Schema.Struct({
  args: Schema.Array(Schema.String),
  sensitive: Schema.Array(Schema.String),
});

const encodeJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

const plan = LoadPlan.make({
  ...BLUEPRINT_PLAN,
  proctors: 2,
  rooms: 2,
  students: 120,
});

describe("load seed", () => {
  it.effect(
    "seeds the exam, then seats the students and two proctors a room in calls of ten, keeping every token secret",
    () =>
      Effect.gen(function* () {
        const calls = MutableList.make<typeof Call.Type>();
        const seeded = yield* seedRun(
          (_operation, args, sensitive = []) => {
            MutableList.append(calls, { args, sensitive });
            return Effect.succeed(
              args[1] === "exams/seed:load"
                ? encodeJson({
                    examId: "e1",
                    sittings: [
                      { id: "s1", room: "Ruang 01", token: "AAAAAA" },
                      { id: "s2", room: "Ruang 02", token: "BBBBBB" },
                    ],
                  })
                : ""
            );
          },
          plan,
          "sekolah"
        );
        const made = MutableList.toArray(calls);
        expect(Arr.take(made[0]?.args ?? [], 2)).toEqual([
          "run",
          "exams/seed:load",
        ]);
        expect(made[0]?.args[2]).toBe(
          encodeJson({ questions: 40, rooms: 2, slug: "sekolah" })
        );
        const batches = Arr.map(Arr.drop(made, 1), (call) =>
          Schema.decodeSync(SeatsArgs)(call.args[2] ?? "")
        );
        expect(
          Arr.map(batches, (batch) => [batch.kind, batch.seats.length])
        ).toEqual([...Arr.replicate(["student", 10], 12), ["proctor", 4]]);
        expect(
          Arr.every(Arr.drop(made, 1), (call, index) =>
            Arr.every(batches[index]?.seats ?? [], (seat) =>
              Arr.contains(call.sensitive, seat.token)
            )
          )
        ).toBe(true);
        expect(batches[0]?.seats[0]?.name).toBe("Siswa 0001");
        expect(batches[12]?.seats[3]?.name).toBe("Pengawas 0004");
        expect(
          Arr.dedupe(
            Arr.flatMap(batches, (batch) =>
              Arr.map(batch.seats, (seat) => seat.key)
            )
          )
        ).toHaveLength(124);
        expect(seeded.rooms).toHaveLength(2);
        expect(
          Arr.map(Arr.take(seeded.students, 3), (seat) => seat.room)
        ).toEqual([0, 1, 0]);
        expect(seeded.proctors).toHaveLength(4);
        expect(seeded.students[0]?.token).toBe(batches[0]?.seats[0]?.token);
      }).pipe(Effect.provide(nodeServicesLayer))
  );
});
