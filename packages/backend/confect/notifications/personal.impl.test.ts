import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { keyedFixture } from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { list, set } = refs.public.notifications.personal;

describe("notifications/personal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "keeps what the account switched off, for itself alone, and repeating a choice changes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const student = fixture.as("student");
        const choice = { channel: "email", kind: "commentReply" } as const;
        expect(yield* student.query(list, {})).toEqual([]);

        yield* student.mutation(set, { ...choice, on: false });
        yield* student.mutation(set, { ...choice, on: false });
        expect(yield* student.query(list, {})).toEqual([choice]);
        expect(yield* fixture.as("teacher").query(list, {})).toEqual([]);

        yield* student.mutation(set, { ...choice, on: true });
        yield* student.mutation(set, { ...choice, on: true });
        expect(yield* student.query(list, {})).toEqual([]);
      })
  );

  it.effect("leaves a kind the account never gets as it is", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const student = fixture.as("student");
      yield* student.mutation(set, {
        channel: "email",
        kind: "forumMention",
        on: false,
      });
      expect(yield* student.query(list, {})).toEqual([]);
    })
  );
});
