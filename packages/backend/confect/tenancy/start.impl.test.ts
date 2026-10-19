import type { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { loginAddress } from "@repo/backend/confect/identity/address";
import {
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Result, Struct } from "effect";

const draft = refs.public.tenancy.start.draft;
const save = refs.public.tenancy.start.save;
const address = refs.public.tenancy.start.address;
const open = refs.public.tenancy.start.open;
const viewer = refs.public.tenancy.viewer.get;

/** The answers of a school in Makassar that teaches SD and SMP. */
const harapan = (slug: string): Ref.Args<typeof open> => ({
  country: "ID",
  name: "Harapan Bangsa",
  role: "teacher",
  size: "m",
  slug: slugOf(slug),
  timeZone: "Asia/Makassar",
  units: [
    { level: "sd", name: "SD Harapan Bangsa" },
    { level: "smp", name: "SMP Harapan Bangsa" },
  ],
});

/** Every row a founding writes for one tenant: its Persons, units, periods, and journal types. */
const foundedRows = (slug: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .get("by_slug", slugOf(slug))
      .pipe(Effect.orDie);
    const people = yield* reader
      .table("tenantPeople")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id)
      )
      .take(10);
    const units = yield* reader
      .table("tenantUnits")
      .index("by_creation_time")
      .take(100);
    const periods = yield* reader
      .table("tenantPeriods")
      .index("by_creation_time")
      .take(100);
    const entries = yield* reader
      .table("journalEntries")
      .index("by_creation_time")
      .take(500);
    return {
      entries: Arr.filterMap(entries, (entry) =>
        entry.owner.kind === "tenant" && entry.owner.tenantId === tenant._id
          ? Result.succeed(entry.change.type)
          : Result.failVoid
      ),
      people,
      periods: Arr.filter(periods, (period) => period.tenantId === tenant._id),
      tenant,
      units: Arr.filter(units, (unit) => unit.tenantId === tenant._id),
    };
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
  vi.stubEnv("SITE_URL", "https://nakafa.com");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("tenancy/start", () => {
  it.effect(
    "opens a school its founder runs at once, with a unit and an open school year for each level",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const founder = yield* fixture.account(
          "founder",
          "guru@harapan.example.test",
          true
        );
        yield* founder.client.mutation(save, {
          answer: {
            kind: "name",
            name: "Harapan Bangsa",
            slug: slugOf("harapan"),
          },
        });
        const opened = yield* founder.client.mutation(open, harapan("harapan"));
        expect(opened).toEqual({
          address: "https://harapan.nakafa.com/",
          slug: "harapan",
        });

        const rows = yield* fixture.run(foundedRows("harapan"));
        expect(
          Struct.pick(rows.tenant, ["country", "currency", "kind", "name"])
        ).toEqual({
          country: "ID",
          currency: "IDR",
          kind: "school",
          name: "Harapan Bangsa",
        });
        expect(
          Arr.map(rows.people, (person) => ({
            account: person.account,
            name: person.name,
          }))
        ).toEqual([
          {
            account: {
              claimedAt: TENANCY_NOW,
              method: "founder",
              state: "claimed",
              userId: founder.userId,
            },
            name: "User founder",
          },
        ]);
        expect(
          Arr.map(rows.units, (unit) =>
            Struct.pick(unit, ["contentLanguage", "level", "name", "timeZone"])
          )
        ).toEqual([
          {
            contentLanguage: "id",
            level: "sd",
            name: "SD Harapan Bangsa",
            timeZone: "Asia/Makassar",
          },
          {
            contentLanguage: "id",
            level: "smp",
            name: "SMP Harapan Bangsa",
            timeZone: "Asia/Makassar",
          },
        ]);
        expect(
          Arr.map(rows.periods, (period) =>
            Struct.pick(period, ["end", "name", "start", "status"])
          )
        ).toEqual(
          Arr.replicate(
            {
              end: "2027-06-30",
              name: "2026/2027",
              start: "2026-07-01",
              status: "active",
            },
            2
          )
        );
        expect(rows.entries).toEqual([
          "tenant.founded",
          "person.created",
          "person.claimed",
          "grant.created",
          "grant.created",
          "unit.created",
          "period.created",
          "period.opened",
          "unit.created",
          "period.created",
          "period.opened",
        ]);

        const view = yield* founder.client.query(viewer, {
          slug: slugOf("harapan"),
        });
        expect(Arr.map(view.grants, (grant) => grant.role.key)).toEqual([
          "owner",
          "teacher",
        ]);
        expect(yield* founder.client.query(draft, {})).toBeNull();
      })
  );

  it.effect(
    "opens a foundation in Singapore with its Owner alone and a school year from January",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const founder = yield* fixture.account(
          "foundation",
          "ketua@yayasan.example.test",
          true
        );
        yield* fixture.run(
          Effect.gen(function* () {
            yield* (yield* DatabaseWriter)
              .table("users")
              .patch(founder.userId, { name: " \t\r\n " })
              .pipe(Effect.orDie);
          })
        );
        yield* founder.client.mutation(open, {
          ...harapan("yayasan"),
          country: "SG",
          role: "foundation",
          timeZone: "Europe/Berlin",
          units: [{ level: "sma", name: "Yayasan Upper Secondary" }],
        });

        const rows = yield* fixture.run(foundedRows("yayasan"));
        expect(Struct.pick(rows.tenant, ["currency", "kind"])).toEqual({
          currency: "SGD",
          kind: "foundation",
        });
        expect(Arr.map(rows.people, (person) => person.name)).toEqual([
          "ketua",
        ]);
        expect(
          Arr.map(rows.units, (unit) =>
            Struct.pick(unit, ["contentLanguage", "timeZone"])
          )
        ).toEqual([{ contentLanguage: "en", timeZone: "Asia/Singapore" }]);
        expect(
          Arr.map(rows.periods, (period) =>
            Struct.pick(period, ["end", "name", "start"])
          )
        ).toEqual([{ end: "2026-12-31", name: "2026", start: "2026-01-01" }]);
        const view = yield* founder.client.query(viewer, {
          slug: slugOf("yayasan"),
        });
        expect(Arr.map(view.grants, (grant) => grant.role.key)).toEqual([
          "owner",
        ]);
      })
  );

  it.effect(
    "names the founder's Person on one line, whatever breaks the account's name holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const founder = yield* fixture.account(
          "lines",
          "baris@harapan.example.test",
          true
        );
        yield* fixture.run(
          Effect.gen(function* () {
            yield* (yield* DatabaseWriter)
              .table("users")
              .patch(founder.userId, { name: "Bu\tSari\r\n Wulandari\u0007" })
              .pipe(Effect.orDie);
          })
        );
        yield* founder.client.mutation(open, harapan("baris"));
        const rows = yield* fixture.run(foundedRows("baris"));
        expect(Arr.map(rows.people, (person) => person.name)).toEqual([
          "Bu Sari Wulandari",
        ]);
      })
  );

  it.effect(
    "checks an address as the founder types, and refuses one that is reserved or taken",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const founder = yield* fixture.account(
          "address",
          "tu@harapan.example.test",
          true
        );
        const states = yield* Effect.forEach(
          ["harapan-baru", "nf", "new", "Bad Address"],
          (slug) => founder.client.query(address, { slug })
        );
        expect(states).toEqual(["free", "taken", "reserved", "invalid"]);

        const refusals = yield* Effect.forEach(["nf", "new"], (slug) =>
          founder.client.mutation(open, harapan(slug)).pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([
          { _tag: "FoundingRefused", code: "SLUG_TAKEN" },
          { _tag: "FoundingRefused", code: "SLUG_RESERVED" },
        ]);
      })
  );

  it.effect(
    "refuses an opening from a school login account, and opens nothing for its address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const card = yield* fixture.account(
          "card",
          loginAddress("harapan-card"),
          false
        );
        yield* card.client.mutation(save, {
          answer: {
            kind: "name",
            name: "Harapan Bangsa",
            slug: slugOf("harapan"),
          },
        });
        const refused = yield* card.client
          .mutation(open, harapan("harapan"))
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "FoundingRefused",
          code: "LOGIN_ACCOUNT",
        });
        expect(yield* card.client.query(address, { slug: "harapan" })).toBe(
          "free"
        );
      })
  );

  it.effect(
    "lets one account found three schools it runs, and no more than three a day",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const founder = yield* fixture.account(
          "limit",
          "pendiri@harapan.example.test",
          true
        );
        yield* Effect.forEach(["satu", "dua", "tiga"], (slug) =>
          founder.client.mutation(open, harapan(slug))
        );
        const limited = yield* founder.client
          .mutation(open, harapan("empat"))
          .pipe(Effect.flip);
        expect(limited).toMatchObject({
          _tag: "FoundingRefused",
          code: "SCHOOL_LIMIT",
        });

        // Leaving one school frees a place, but the day's openings are spent.
        yield* fixture.run(
          Effect.gen(function* () {
            const rows = yield* foundedRows("satu");
            const writer = yield* DatabaseWriter;
            yield* Effect.forEach(rows.people, (person) =>
              writer
                .table("tenantPeople")
                .patch(person._id, { status: "removed" })
                .pipe(Effect.orDie)
            );
          })
        );
        const rated = yield* founder.client
          .mutation(open, harapan("empat"))
          .pipe(Effect.flip);
        expect(rated).toMatchObject({
          _tag: "FoundingRefused",
          code: "RATE_LIMITED",
        });
      })
  );

  it.effect(
    "saves each answer over the account's draft, so the questionnaire resumes",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const founder = yield* fixture.account(
          "draft",
          "draf@harapan.example.test",
          true
        );
        expect(yield* founder.client.query(draft, {})).toBeNull();
        yield* founder.client.mutation(save, {
          answer: { kind: "country", value: "DE" },
        });
        yield* founder.client.mutation(save, {
          answer: { kind: "levels", value: ["sd", "smp"] },
        });
        yield* founder.client.mutation(save, {
          answer: { kind: "role", value: "principal" },
        });
        const saved = yield* founder.client.mutation(save, {
          answer: { kind: "size", value: "xl" },
        });
        expect(saved).toEqual({
          country: "DE",
          levels: ["sd", "smp"],
          role: "principal",
          size: "xl",
          updatedAt: TENANCY_NOW,
        });
        expect(yield* founder.client.query(draft, {})).toEqual(saved);
      })
  );

  it.effect("requires a session for every step", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denials = yield* Effect.all([
        fixture.anonymous.query(draft, {}).pipe(Effect.flip),
        fixture.anonymous
          .mutation(save, { answer: { kind: "size", value: "s" } })
          .pipe(Effect.flip),
        fixture.anonymous.query(address, { slug: "harapan" }).pipe(Effect.flip),
        fixture.anonymous.mutation(open, harapan("harapan")).pipe(Effect.flip),
      ]);
      expect(Arr.map(denials, (denial) => denial._tag)).toEqual(
        Arr.replicate("SessionRequired", 4)
      );
    })
  );
});
