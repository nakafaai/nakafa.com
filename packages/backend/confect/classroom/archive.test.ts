import { describe, expect, it } from "@effect/vitest";
import type { ClassroomTasksDoc } from "@repo/backend/confect/_generated/docs";
import {
  archiveMark,
  isArchived,
  onShelf,
} from "@repo/backend/confect/classroom/archive";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

const live: Pick<ClassroomTasksDoc, "archivedAt" | "slug"> = { slug: "live" };
const shelved: Pick<ClassroomTasksDoc, "archivedAt" | "slug"> = {
  archivedAt: 5,
  slug: "shelved",
};

describe("classroom/archive", () => {
  it("reads a row as archived once it holds the time of its archive, and keeps one shelf of a page", () => {
    expect([isArchived(live), isArchived(shelved)]).toEqual([false, true]);
    expect(onShelf([live, shelved], true)).toEqual([shelved]);
    expect(onShelf([live, shelved], false)).toEqual([live]);
  });

  it.effect(
    "marks an archive with the time now, and clears the mark to bring a row back",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(42);
        expect([yield* archiveMark(true), yield* archiveMark(false)]).toEqual([
          42,
          undefined,
        ]);
      })
  );
});
