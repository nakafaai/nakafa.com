import type { GenericId, Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  journal,
  slugOf,
  suspend,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const other = slugOf("other");
const viewer = refs.public.tenancy.viewer.get;
const { archive, setLocale, unarchive } = refs.public.tenancy.units;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const notMember = { _tag: "NotMember", code: "NOT_MEMBER" };
const invalid = { _tag: "SchemaError" };

/** A request to move a school to the Makassar clock and to English. */
const makassar = (
  unitId: GenericId.GenericId<"tenantUnits">
): Ref.Args<typeof setLocale> => ({
  contentLanguage: "en",
  slug: nf,
  timeZone: "Asia/Makassar",
  unitId,
});

describe("tenancy/units setLocale", () => {
  it.effect(
    "sets the time zone and the content language of a school, and records it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const answer = yield* fixture.as("owner").mutation(setLocale, {
          contentLanguage: "de",
          slug: nf,
          timeZone: "Europe/Berlin",
          unitId: fixture.units.smp,
        });
        const view = yield* fixture.as("owner").query(viewer, { slug: nf });
        const entries = yield* fixture.run(journal);
        expect(answer).toEqual({
          contentLanguage: "de",
          timeZone: "Europe/Berlin",
        });
        expect(view.units).toContainEqual({
          contentLanguage: "de",
          id: fixture.units.smp,
          level: "smp",
          name: "SMP Nakafa",
          status: "active",
          timeZone: "Europe/Berlin",
        });
        expect(view.units).toContainEqual(
          expect.objectContaining({
            contentLanguage: "id",
            id: fixture.units.sma,
            timeZone: "Asia/Jakarta",
          })
        );
        expect(entries).toMatchObject([
          {
            actor: { id: fixture.people.owner.personId, kind: "person" },
            change: {
              contentLanguage: "de",
              timeZone: "Europe/Berlin",
              type: "unit.locale.set",
            },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: fixture.units.smp, kind: "unit" },
          },
        ]);
      })
  );

  it.effect("writes and records nothing for the values already stored", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.as("owner").mutation(setLocale, {
        contentLanguage: "id",
        slug: nf,
        timeZone: "Asia/Jakarta",
        unitId: fixture.units.smp,
      });
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect(
    "lets an Admin set the school it holds the role for, and no other",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const tenantAdmin = yield* fixture
          .as("admin")
          .mutation(setLocale, makassar(fixture.units.sma));
        const unitAdmin = yield* fixture
          .as("unitAdmin")
          .mutation(setLocale, makassar(fixture.units.smp));
        const elsewhere = yield* fixture
          .as("unitAdmin")
          .mutation(setLocale, makassar(fixture.units.sma))
          .pipe(Effect.flip);
        expect(tenantAdmin).toEqual({
          contentLanguage: "en",
          timeZone: "Asia/Makassar",
        });
        expect(unitAdmin).toEqual(tenantAdmin);
        expect(elsewhere).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "refuses an archived school and every write in a suspended tenant",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const archived = yield* owner
          .mutation(setLocale, makassar(fixture.units.smk))
          .pipe(Effect.flip);
        yield* fixture.run(suspend(fixture.tenants.nf));
        const suspended = yield* owner
          .mutation(setLocale, makassar(fixture.units.smp))
          .pipe(Effect.flip);
        expect([archived, suspended]).toMatchObject([
          denied("condition"),
          denied("condition"),
        ]);
      })
  );

  it.effect("refuses a time zone that is not an IANA zone", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      const refusals = yield* Effect.forEach(
        ["+07:00", "WIB", "Mars/Base", ""],
        (timeZone) =>
          owner
            .mutation(setLocale, {
              ...makassar(fixture.units.smp),
              timeZone,
            })
            .pipe(Effect.flip)
      );
      expect(refusals).toMatchObject([invalid, invalid, invalid, invalid]);
    })
  );
});

describe("tenancy/units archive and unarchive", () => {
  it.effect("archives and restores a school, once each, and records each", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      const request = { slug: nf, unitId: fixture.units.smp };
      const archived = yield* owner.mutation(archive, request);
      yield* owner.mutation(archive, request);
      const listed = yield* owner.query(viewer, { slug: nf });
      const restored = yield* owner.mutation(unarchive, request);
      yield* owner.mutation(unarchive, request);
      const entries = yield* fixture.run(journal);
      expect([archived, restored]).toEqual(["archived", "active"]);
      expect(listed.units).toContainEqual(
        expect.objectContaining({ id: fixture.units.smp, status: "archived" })
      );
      expect(entries).toMatchObject([
        {
          actor: { id: fixture.people.owner.personId, kind: "person" },
          change: { type: "unit.archived" },
          subject: { id: fixture.units.smp, kind: "unit" },
        },
        {
          actor: { id: fixture.people.owner.personId, kind: "person" },
          change: { type: "unit.unarchived" },
          subject: { id: fixture.units.smp, kind: "unit" },
        },
      ]);
    })
  );

  it.effect(
    "restores a school that is archived, which refuses every other write",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const restored = yield* fixture
          .as("admin")
          .mutation(unarchive, { slug: nf, unitId: fixture.units.smk });
        const view = yield* fixture.as("admin").query(viewer, { slug: nf });
        expect(restored).toBe("active");
        expect(view.units).toContainEqual(
          expect.objectContaining({ id: fixture.units.smk, status: "active" })
        );
      })
  );

  it.effect("refuses a suspended tenant", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(suspend(fixture.tenants.nf));
      const denial = yield* fixture
        .as("owner")
        .mutation(archive, { slug: nf, unitId: fixture.units.smp })
        .pipe(Effect.flip);
      expect(denial).toMatchObject(denied("condition"));
    })
  );
});

describe("tenancy/units access", () => {
  it.effect(
    "refuses every role but Owner and Admin, a Person without a grant, and a stranger",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const refused = (account: Parameters<typeof fixture.as>[0]) => {
          const client = fixture.as(account);
          return Effect.all([
            client
              .mutation(archive, { slug: nf, unitId: fixture.units.smp })
              .pipe(Effect.flip),
            client
              .mutation(unarchive, { slug: nf, unitId: fixture.units.smk })
              .pipe(Effect.flip),
            client
              .mutation(setLocale, makassar(fixture.units.sma))
              .pipe(Effect.flip),
          ]);
        };
        const byRole = yield* Effect.forEach(
          [
            "teacher",
            "student",
            "principal",
            "auditor",
            "visitor",
            "unitAdmin",
          ] satisfies readonly Parameters<typeof fixture.as>[0][],
          refused
        );
        const outside = yield* Effect.forEach(
          ["suspended", "stranger", "otherOwner"] satisfies readonly Parameters<
            typeof fixture.as
          >[0][],
          refused
        );
        expect(Arr.flatten(byRole)).toMatchObject(
          Arr.replicate(denied("role"), 18)
        );
        expect(Arr.flatten(outside)).toMatchObject(Arr.replicate(notMember, 9));
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );

  it.effect("keeps one tenant's schools from another tenant's Owner", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      const foreign = yield* Effect.all([
        owner.mutation(setLocale, makassar(fixture.units.sd)).pipe(Effect.flip),
        owner
          .mutation(archive, { slug: nf, unitId: fixture.units.sd })
          .pipe(Effect.flip),
        owner
          .mutation(unarchive, { slug: nf, unitId: fixture.units.sd })
          .pipe(Effect.flip),
        fixture
          .as("otherOwner")
          .mutation(archive, { slug: other, unitId: fixture.units.smp })
          .pipe(Effect.flip),
        owner
          .mutation(archive, { slug: other, unitId: fixture.units.sd })
          .pipe(Effect.flip),
      ]);
      const stored = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          Effect.all({
            sd: reader.table("tenantUnits").get(fixture.units.sd),
            smp: reader.table("tenantUnits").get(fixture.units.smp),
          })
        )
      );
      expect(foreign).toMatchObject([
        denied("resource"),
        denied("resource"),
        denied("resource"),
        denied("resource"),
        notMember,
      ]);
      expect(stored.sd).toMatchObject({
        contentLanguage: "de",
        status: "active",
        timeZone: "Europe/Berlin",
      });
      expect(stored.smp.status).toBe("active");
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect("requires a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denial = yield* fixture.anonymous
        .mutation(archive, { slug: nf, unitId: fixture.units.smp })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "SessionRequired",
        code: "UNAUTHENTICATED",
      });
    })
  );
});
