import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { keyedFixture } from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const push = refs.public.notifications.push;

/** The subscription a browser gives, under the endpoint `name`. */
const keysOf = (name: string) => ({
  auth: "YXV0aC1zZWNyZXQ",
  endpoint: `https://push.example.test/${name}`,
  p256dh: "Y2xpZW50LWtleQ",
});

/** The endpoints and accounts of every stored subscription, oldest first. */
const stored = (fixture: Effect.Success<typeof keyedFixture>) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("pushSubscriptions")
        .index("by_endpoint")
        .take(50)
        .pipe(
          Effect.map((rows) =>
            Arr.map(rows, (row) => ({
              endpoint: row.endpoint,
              userId: row.userId,
            }))
          )
        )
    )
  );

describe("notifications/push", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "keeps one subscription per browser, moves it to the account that subscribed last, and drops the oldest past ten",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const student = fixture.as("student");
        const teacher = fixture.as("teacher");
        yield* student.mutation(push.subscribe, keysOf("shared"));
        yield* teacher.mutation(push.subscribe, keysOf("shared"));
        expect(yield* stored(fixture)).toEqual([
          {
            endpoint: "https://push.example.test/shared",
            userId: fixture.users.teacher.userId,
          },
        ]);
        yield* Effect.forEach(Arr.range(1, 10), (index) =>
          Effect.andThen(
            Effect.sync(() => vi.setSystemTime(TENANCY_NOW + index)),
            teacher.mutation(push.subscribe, keysOf(`browser-${index}`))
          )
        );
        const kept = yield* stored(fixture);
        expect(kept).toHaveLength(10);
        expect(Arr.some(kept, (row) => row.endpoint.endsWith("/shared"))).toBe(
          false
        );

        // An account forgets only its own browsers.
        yield* student.mutation(push.unsubscribe, {
          endpoint: "https://push.example.test/browser-1",
        });
        expect(yield* stored(fixture)).toHaveLength(10);
        yield* teacher.mutation(push.unsubscribe, {
          endpoint: "https://push.example.test/browser-1",
        });
        expect(yield* stored(fixture)).toHaveLength(9);
      })
  );
});
