import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { runProctor } from "@repo/backend/scripts/load/proctor";
import { Recorder, recorderLayer } from "@repo/backend/scripts/load/recorder";
import { fakeServer, SEATS } from "@repo/backend/test/load";
import { Array as Arr, Deferred, Effect, Fiber, Schema } from "effect";

const seating = {
  sittingId: "s1",
  slug: Schema.decodeSync(TenantSlug)("sekolah"),
};

describe("load proctor", () => {
  it.live(
    "watches the room's first page and each seat's latest answer until the run is done",
    () =>
      Effect.gen(function* () {
        const server = fakeServer();
        const done = yield* Deferred.make<void>();
        const proctor = yield* Effect.forkChild(
          runProctor({ done, open: server.open, seating })
        );
        // The proctor watches the page, then one seat after another.
        yield* Effect.sleep("5 millis").pipe(
          Effect.repeat({
            until: () => server.listeners.length === 1 + SEATS.length,
          }),
          Effect.timeout("2 seconds")
        );
        const [page] = server.listeners;
        expect(page?.args).toMatchObject({
          paginationOpts: { cursor: null, numItems: 100 },
          sittingId: "s1",
        });
        // A page that shows the same seats again watches no seat twice.
        server.push("exams/sittings:dashboard");
        yield* Deferred.succeed(done, undefined);
        expect(yield* Fiber.join(proctor)).toBe(SEATS.length);
        const seats = Arr.filter(
          server.listeners,
          (listener) => listener.name === "exams/sittings:lastAnswer"
        );
        expect(Arr.map(seats, (seat) => seat.args.attemptId)).toEqual(SEATS);
        expect(Arr.every(server.listeners, (listener) => !listener.open)).toBe(
          true
        );
        const recorder = yield* Recorder;
        const names = Arr.map(yield* recorder.samples, (sample) => sample.name);
        expect(names).toEqual([
          "query:dashboard",
          "query:lastAnswer",
          "query:lastAnswer",
        ]);
      }).pipe(Effect.provide(recorderLayer))
  );
});
