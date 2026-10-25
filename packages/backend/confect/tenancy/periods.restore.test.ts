import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const nf = slugOf("nf");
const { archive, create, open, restore } = refs.public.tenancy.periods;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const missingPeriod = Schema.decodeUnknownSync(Id("tenantPeriods"))(
  "000000000000000099999tenantPeriods"
);
const SMA_TERMS = {
  end: "2026-12-19",
  name: "Ganjil 2026/2027",
  start: "2026-07-13",
};

/** Creates one period as the school's Admin, and returns the period the mutation made. */
const admin = (
  fixture: Effect.Success<typeof tenancyFixture>,
  term: { end: string; name: string; start: string }
) =>
  fixture.as("admin").mutation(create, {
    ...term,
    slug: nf,
    unitId: fixture.units.sma,
  });

describe("tenancy/periods restore", () => {
  it.effect(
    "restores an archived period to active, refuses while another is active, and journals the restore",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* admin(fixture, SMA_TERMS);
        yield* fixture
          .as("admin")
          .mutation(open, { periodId: first.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(archive, { periodId: first.id, slug: nf });
        const second = yield* admin(fixture, {
          end: "2027-06-30",
          name: "Genap 2026/2027",
          start: "2027-01-04",
        });
        yield* fixture
          .as("admin")
          .mutation(open, { periodId: second.id, slug: nf });
        const blocked = yield* fixture
          .as("admin")
          .mutation(restore, { periodId: first.id, slug: nf })
          .pipe(Effect.flip);
        yield* fixture
          .as("admin")
          .mutation(archive, { periodId: second.id, slug: nf });
        const restored = yield* fixture
          .as("admin")
          .mutation(restore, { periodId: first.id, slug: nf });
        expect([blocked, restored.status]).toMatchObject([
          { _tag: "PeriodActive" },
          "active",
        ]);
        const entries = yield* fixture.run(journal);
        expect(
          Arr.filter(
            entries,
            (entry) => entry.change.type === "period.restored"
          )
        ).toMatchObject([{ subject: { id: first.id } }]);
      })
  );

  it.effect(
    "refuses to restore a period of another school, and keeps it archived",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const foreign = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Ganjil lain",
              start: "2026-07-13",
              status: "archived",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            })
          )
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(restore, { periodId: foreign, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("resource"));
      })
  );

  it.effect(
    "refuses to restore a period that does not exist, as a resource",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const refused = yield* fixture
          .as("admin")
          .mutation(restore, { periodId: missingPeriod, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("resource"));
      })
  );

  it.effect("changes nothing when the period is already active", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* admin(fixture, SMA_TERMS);
      yield* fixture
        .as("admin")
        .mutation(open, { periodId: period.id, slug: nf });
      const entries = Arr.length(yield* fixture.run(journal));
      const again = yield* fixture
        .as("admin")
        .mutation(restore, { periodId: period.id, slug: nf });
      expect(again.status).toBe("active");
      expect(Arr.length(yield* fixture.run(journal))).toBe(entries);
    })
  );

  it.effect(
    "refuses to restore a period whose unit is archived, as a condition",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        yield* fixture
          .as("admin")
          .mutation(open, { periodId: period.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(archive, { periodId: period.id, slug: nf });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantUnits")
              .patch(fixture.units.sma, { status: "archived" })
          )
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(restore, { periodId: period.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("condition"));
      })
  );
});
