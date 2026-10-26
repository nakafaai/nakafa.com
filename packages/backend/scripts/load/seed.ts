import { Id } from "@repo/backend/confect/_generated/id";
import type { SeatKind } from "@repo/backend/confect/exams/seed/contract";
import type { RunConvex } from "@repo/backend/scripts/content/acceptance/account";
import type { LoadPlan } from "@repo/backend/scripts/load/plan";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Crypto, Effect, Schema } from "effect";
import { Base64Url, Hex } from "effect/encoding";

/**
 * The seats one seed call seats: half of what the seed function takes, so a call stays well
 * inside the local backend's five-second limit on a busy machine. Each seat writes two Better
 * Auth rows, the app profile, a Person and a grant.
 */
const SEATS_PER_CALL = 25;

/** How many seed calls run at once: each is a Convex CLI process of its own. */
const SEED_CONCURRENCY = 4;

/** One room of the run as the load seed opened it, with its token. */
const Room = Schema.Struct({
  id: Id("examSittings"),
  room: Schema.String,
  token: Schema.String,
});

/** The exam and its rooms, as the load seed prints them. */
const Seeded = Schema.fromJsonString(
  Schema.Struct({ examId: Id("exams"), sittings: Schema.Array(Room) })
);

const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/**
 * Seats `count` accounts of one kind, in calls of `SEATS_PER_CALL`. Each seat gets a key of
 * its own for its placeholder address, a numbered name, and a new session token, which the
 * runner keeps out of its errors. The rooms go round in turn, as the students' scripts fill them.
 */
const seatAll = Effect.fn("load.seed.seats")(function* <E, R>(
  run: RunConvex<E, R>,
  seating: {
    readonly count: number;
    readonly kind: typeof SeatKind.Type;
    readonly rooms: number;
    readonly runId: string;
    readonly slug: string;
  }
) {
  const crypto = yield* Crypto.Crypto;
  const seats = yield* Effect.forEach(
    Arr.makeBy(seating.count, (index) => index),
    Effect.fn(function* (index) {
      const number = String(index + 1).padStart(4, "0");
      return {
        key: `load-${seating.runId}-${seating.kind}-${number}`,
        name: `${seating.kind === "student" ? "Siswa" : "Pengawas"} ${number}`,
        room: index % seating.rooms,
        token: Base64Url.encode(yield* crypto.randomBytes(32)),
      };
    })
  );
  yield* Effect.forEach(
    Arr.chunksOf(seats, SEATS_PER_CALL),
    (batch) =>
      encodeArguments({
        kind: seating.kind,
        seats: Arr.map(batch, ({ key, name, token }) => ({ key, name, token })),
        slug: seating.slug,
      }).pipe(
        Effect.flatMap((args) =>
          run(
            "Load seats",
            ["run", "exams/seed:seats", args],
            Arr.map(batch, (seat) => seat.token)
          )
        )
      ),
    { concurrency: SEED_CONCURRENCY, discard: true }
  );
  return Arr.map(seats, ({ room, token }) => ({ room, token }));
});

/**
 * Seeds one run in a school that has its Owner signed in: the exam and its rooms through the
 * load seed, then every student, and the proctors of every room. Each run draws its own key for
 * its seats, so a second run in the same runtime seats new accounts.
 */
export const seedRun = Effect.fn("load.seed")(function* <E, R>(
  run: RunConvex<E, R>,
  plan: LoadPlan,
  slug: string
) {
  const crypto = yield* Crypto.Crypto;
  const runId = Hex.encode(yield* crypto.randomBytes(3));
  const seeded = yield* encodeArguments({
    questions: plan.questions,
    rooms: plan.rooms,
    slug,
  }).pipe(
    Effect.flatMap((args) =>
      run("Load exam", ["run", "exams/seed:load", args])
    ),
    Effect.flatMap(Schema.decodeEffect(Seeded))
  );
  const students = yield* seatAll(run, {
    count: plan.students,
    kind: "student",
    rooms: plan.rooms,
    runId,
    slug,
  });
  const proctors = yield* seatAll(run, {
    count: plan.rooms * plan.proctors,
    kind: "proctor",
    rooms: plan.rooms,
    runId,
    slug,
  });
  return { proctors, rooms: seeded.sittings, students };
});
