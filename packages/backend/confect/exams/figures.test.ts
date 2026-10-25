import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { figureImages } from "@repo/backend/confect/exams/figures";
import { nf } from "@repo/backend/test/editor";
import { storeFile } from "@repo/backend/test/logo";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { create } = refs.public.exams.exams;
const { register } = refs.public.exams.assets;

/** An image of a few bytes, which the server accepts as a PNG. */
const png = () =>
  new Blob(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])],
    { type: "image/png" }
  );

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
        const teacher = fixture.as("teacher");
        const exam = (title: string) =>
          teacher.mutation(create, {
            scope: { kind: "unit", unitId: fixture.units.smp },
            slug: nf,
            title,
          });
        const own = yield* exam("PTS Matematika");
        const other = yield* exam("PTS Fisika");
        const image = (examId: typeof own.id) =>
          Effect.flatMap(storeFile(fixture.convex, png()), (storageId) =>
            teacher.action(register, {
              examId,
              height: 30,
              slug: nf,
              storageId,
              width: 40,
            })
          );
        const mine = yield* image(own.id);
        const foreign = yield* image(other.id);
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
