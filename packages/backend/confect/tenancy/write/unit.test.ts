import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { denied, nf } from "@repo/backend/test/editor";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create, list } = refs.public.tenancy.units;

describe("tenancy/units create", () => {
  it.effect(
    "lets an Admin add a school with its level, time zone, and page language, and records it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("admin").mutation(create, {
          contentLanguage: "en",
          level: "sma",
          name: "SMA Harapan",
          slug: nf,
          timeZone: "Asia/Makassar",
        });
        expect(made).toEqual({
          contentLanguage: "en",
          id: expect.any(String),
          level: "sma",
          name: "SMA Harapan",
          npsn: null,
          status: "active",
          timeZone: "Asia/Makassar",
        });
        const listed = yield* fixture.as("admin").query(list, { slug: nf });
        expect(Arr.map(listed, (unit) => unit.id)).toContain(made.id);
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            change: { type: "unit.created" },
            subject: { id: made.id, kind: "unit" },
          },
        ]);
      })
  );

  it.effect(
    "refuses a school past the limit of the organisation, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        // The school holds three schools already, so 21 more fill the 24 it may hold.
        yield* Effect.forEach(
          Arr.makeBy(21, (index) => index),
          (index) =>
            admin.mutation(create, {
              contentLanguage: "id",
              level: "smp",
              name: `SMP ${index + 1}`,
              slug: nf,
              timeZone: "Asia/Jakarta",
            })
        );
        const refused = yield* admin
          .mutation(create, {
            contentLanguage: "id",
            level: "smp",
            name: "SMP Lebih",
            slug: nf,
            timeZone: "Asia/Jakarta",
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "UnitLimit",
          code: "UNIT_LIMIT",
        });
        const listed = yield* admin.query(list, { slug: nf });
        expect(listed).toHaveLength(24);
      })
  );

  it.effect("refuses a teacher, who does not hold tenant.manage", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture
        .as("teacher")
        .mutation(create, {
          contentLanguage: "id",
          level: "smp",
          name: "SMP Guru",
          slug: nf,
          timeZone: "Asia/Jakarta",
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("role"));
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );
});
