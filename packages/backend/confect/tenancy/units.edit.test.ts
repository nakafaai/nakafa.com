import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { edit, list } = refs.public.tenancy.units;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const invalid = { _tag: "SchemaError" };

describe("tenancy/units edit", () => {
  it.effect(
    "renames a school and changes its level, answers both, and records each change on its own",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const answer = yield* fixture.as("owner").mutation(edit, {
          level: "mts",
          name: "MTs Nurul Fikri",
          slug: nf,
          unitId: fixture.units.smp,
        });
        const listed = yield* fixture.as("owner").query(list, { slug: nf });
        const entries = yield* fixture.run(journal);
        expect(answer).toEqual({ level: "mts", name: "MTs Nurul Fikri" });
        expect(
          Arr.findFirst(listed, (unit) => unit.id === fixture.units.smp)
        ).toMatchObject({
          value: { level: "mts", name: "MTs Nurul Fikri" },
        });
        expect(entries).toMatchObject([
          {
            actor: { id: fixture.people.owner.personId, kind: "person" },
            change: { name: "MTs Nurul Fikri", type: "unit.name.set" },
            subject: { id: fixture.units.smp, kind: "unit" },
          },
          {
            change: { level: "mts", type: "unit.level.set" },
            subject: { id: fixture.units.smp, kind: "unit" },
          },
        ]);
      })
  );

  it.effect(
    "records only the value that changed, and nothing for values already stored",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        yield* owner.mutation(edit, {
          level: "smp",
          name: "SMP Nakafa",
          slug: nf,
          unitId: fixture.units.smp,
        });
        expect(yield* fixture.run(journal)).toEqual([]);
        yield* owner.mutation(edit, {
          level: "mts",
          name: "SMP Nakafa",
          slug: nf,
          unitId: fixture.units.smp,
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { level: "mts", type: "unit.level.set" } },
        ]);
      })
  );

  it.effect(
    "refuses a teacher, an archived school, and a name that is not one trimmed line",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = yield* fixture
          .as("teacher")
          .mutation(edit, {
            level: "smp",
            name: "SMP Baru",
            slug: nf,
            unitId: fixture.units.smp,
          })
          .pipe(Effect.flip);
        const archived = yield* fixture
          .as("owner")
          .mutation(edit, {
            level: "smk",
            name: "SMK Baru",
            slug: nf,
            unitId: fixture.units.smk,
          })
          .pipe(Effect.flip);
        const untrimmed = yield* fixture
          .as("owner")
          .mutation(edit, {
            level: "smp",
            name: " SMP Baru",
            slug: nf,
            unitId: fixture.units.smp,
          })
          .pipe(Effect.flip);
        expect([teacher, archived]).toMatchObject([
          denied("role"),
          denied("condition"),
        ]);
        expect(untrimmed).toMatchObject(invalid);
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );
});
