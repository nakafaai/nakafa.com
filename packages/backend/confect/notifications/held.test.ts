import { describe, expect, it } from "@effect/vitest";
import {
  HELD_SCHOOL_LIMIT,
  heldPersons,
} from "@repo/backend/confect/notifications/held";
import { claimedPersons } from "@repo/backend/test/inbox";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

describe("notifications/held persons", () => {
  it.effect(
    "reads every Person of an account that holds as many as one request reads",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        const persons = yield* claimedPersons(
          fixture,
          ana.userId,
          HELD_SCHOOL_LIMIT
        );
        const held = yield* fixture.run(heldPersons(ana.userId));
        expect(held).toHaveLength(HELD_SCHOOL_LIMIT);
        expect(Arr.map(held, (person) => person._id)).toEqual(
          expect.arrayContaining(persons)
        );
      })
  );

  it.effect(
    "refuses an account that holds more Persons than one request reads, instead of reading some of them",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const ana = yield* fixture.account(
          "ana",
          "ana@harapan.example.test",
          true
        );
        yield* claimedPersons(fixture, ana.userId, HELD_SCHOOL_LIMIT + 1);
        const refused = yield* fixture.run(
          heldPersons(ana.userId).pipe(
            Effect.flip,
            Effect.map((error) => error._tag)
          )
        );
        expect(refused).toBe("NotificationScopeTooLarge");
      })
  );
});
