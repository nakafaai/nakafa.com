import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import { LANGUAGE } from "@repo/backend/test/exams";
import { storeFile } from "@repo/backend/test/logo";
import {
  deviceOf,
  enterOk,
  openedSitting,
  type SittingFixture,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { create } = refs.public.exams.exams;
const { register } = refs.public.exams.assets;
const { images } = refs.public.exams.sittings;

/** The leading bytes of a PNG file, which the server reads as an image. */
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG file of a few bytes, which the server accepts as an image. */
const png = () =>
  new Blob([Uint8Array.from([...PNG_HEAD, 0, 0, 0, 0])], { type: "image/png" });

/** The exam that a sitting sits for, read from the sitting row. */
const examOf = (fixture: SittingFixture, sittingId: ExamSittingsDoc["_id"]) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("examSittings")
        .get(sittingId)
        .pipe(
          Effect.map((sitting) => sitting.examId),
          Effect.orDie
        )
    )
  );

describe("exams/sittings images", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives the bound student the addresses of the images of the sitting's exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const teacher = fixture.as("teacher");
        const storageId = yield* storeFile(fixture.convex, png());
        const examId = yield* examOf(fixture, made.id);
        const image = yield* teacher.action(register, {
          examId,
          height: 1,
          slug: nf,
          storageId,
          width: 1,
        });
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const addresses = yield* fixture.as("student").query(images, {
          assets: [image.id],
          deviceId: deviceOf(1),
          sittingId: made.id,
          slug: nf,
        });
        expect(addresses).toHaveLength(1);
        expect(addresses[0]).toMatchObject({ id: image.id });
        expect(addresses[0].url.startsWith("http")).toBe(true);
      })
  );

  it.effect(
    "refuses an image of another exam, and reads nothing for a device that does not hold the attempt",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const teacher = fixture.as("teacher");
        const other = yield* teacher.mutation(create, {
          language: LANGUAGE,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Biologi",
        });
        const storageId = yield* storeFile(fixture.convex, png());
        const foreign = yield* teacher.action(register, {
          examId: other.id,
          height: 1,
          slug: nf,
          storageId,
          width: 1,
        });
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const refused = yield* fixture.as("student").query(images, {
          assets: [foreign.id],
          deviceId: deviceOf(1),
          sittingId: made.id,
          slug: nf,
        }).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AccessDenied" });
        const otherDevice = yield* fixture.as("student").query(images, {
          assets: [foreign.id],
          deviceId: deviceOf(2),
          sittingId: made.id,
          slug: nf,
        }).pipe(Effect.flip);
        expect(otherDevice).toMatchObject({ _tag: "SecondDevice" });
      })
  );
});
