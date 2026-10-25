import { beforeEach, describe, expect, it } from "@effect/vitest";
import { figureImages } from "@repo/backend/confect/exams/figures";
import { examImage, teacherExam } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

describe("exams/figures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives each figure of an exam its image's size, and refuses an image of another exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const own = yield* teacherExam(fixture, "PTS Matematika");
        const other = yield* teacherExam(fixture, "PTS Fisika");
        const mine = yield* examImage(fixture, own.id);
        const foreign = yield* examImage(fixture, other.id);
        expect(
          yield* fixture.run(
            figureImages(own.id, [{ alt: "Segitiga", asset: mine.id }])
          )
        ).toEqual([{ alt: "Segitiga", asset: mine.id, height: 30, width: 40 }]);
        expect(
          yield* fixture.run(
            figureImages(own.id, [{ alt: "Gambar", asset: foreign.id }]).pipe(
              Effect.flip,
              Effect.map((refusal) => ({
                reason: refusal.reason,
                tag: refusal._tag,
              }))
            )
          )
        ).toEqual({ reason: "resource", tag: "AccessDenied" });
      })
  );
});
