import type { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import type { Contract } from "@repo/backend/confect/tenancy/contract";
import type { UnitDraft } from "@repo/backend/confect/tenancy/provision.spec";
import { Email, Npsn, UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { workflow } from "@repo/backend/confect/workflow";
import { open as registeredOpen } from "@repo/backend/convex/tenancy/provision";
import {
  scheduledJobs,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Exit, Schema } from "effect";

const open = refs.internal.tenancy.provision.open;
const holdersSchedule = refs.internal.tenancy.holders.schedule;
const claimsRun = refs.internal.tenancy.claims.run;
const viewer = refs.public.tenancy.viewer.get;
const contract: typeof Contract.Type = {
  contentLicense: "1.0",
  dpaVersion: "2026-10",
  modules: ["classes", "exams"],
  plan: "tenant",
};
const address = Schema.decodeSync(Email)("kepala@harapan.example.test");
const stranger = Schema.decodeSync(Email)("lain@harapan.example.test");
const nameField = { field: "name", table: "tenantPeople" };
const sma: typeof UnitDraft.Type = {
  contentLanguage: "id",
  level: "sma",
  name: "SMA Harapan Bangsa",
  npsn: Schema.decodeSync(Npsn)("20100001"),
  timeZone: "Asia/Jakarta",
};
const smp: typeof UnitDraft.Type = {
  contentLanguage: "id",
  level: "smp",
  name: "SMP Harapan Bangsa",
  timeZone: "Asia/Jakarta",
};

/** The command Nakafa staff run: a foundation with its schools and the address of its first Owner. */
const request = (
  slug: string,
  units: readonly (typeof UnitDraft.Type)[]
): Ref.Args<typeof open> => ({
  contract,
  country: "ID",
  currency: "IDR",
  kind: "foundation",
  name: "Yayasan Harapan Bangsa",
  owner: { email: address, name: "Kepala Yayasan" },
  slug: slugOf(slug),
  units,
});

/** How many rows of the tables that opening writes the database holds. */
const counts = Effect.gen(function* () {
  const reader = yield* DatabaseReader;
  return {
    entries: (yield* reader
      .table("journalEntries")
      .index("by_creation_time")
      .take(500)).length,
    invites: (yield* reader
      .table("tenantInvites")
      .index("by_creation_time")
      .take(500)).length,
    keys: (yield* reader
      .table("tenantKeys")
      .index("by_creation_time")
      .take(500)).length,
    people: (yield* reader
      .table("tenantPeople")
      .index("by_creation_time")
      .take(500)).length,
    tenants: (yield* reader
      .table("tenants")
      .index("by_creation_time")
      .take(500)).length,
    units: (yield* reader
      .table("tenantUnits")
      .index("by_creation_time")
      .take(500)).length,
  };
});

/** Fake timers keep the claim run and the invitation workflow from starting before the test looks at them. */
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tenancy/provision open", () => {
  it.effect(
    "writes the tenant, its schools, its first Owner, the invite, and the journal in one go",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const opened = yield* fixture.internal.mutation(
          open,
          request("harapan", [sma, smp])
        );
        const stored = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            return {
              entries: yield* reader
                .table("journalEntries")
                .index("by_creation_time")
                .take(20),
              grants: yield* reader
                .table("tenantGrants")
                .index("by_personId_and_status", (query) =>
                  query.eq("personId", opened.owner).eq("status", "active")
                )
                .take(5),
              invite: yield* reader.table("tenantInvites").get(opened.invite),
              owner: yield* reader.table("tenantPeople").get(opened.owner),
              tenant: yield* reader.table("tenants").get(opened.tenant),
              units: yield* Effect.forEach(opened.units, (id) =>
                reader.table("tenantUnits").get(id)
              ),
            };
          })
        );
        const tenantId = opened.tenant;
        expect(stored.tenant).toMatchObject({
          country: "ID",
          currency: "IDR",
          kind: "foundation",
          name: "Yayasan Harapan Bangsa",
          policies: { emailDomains: [], nina: false, studentThreads: false },
          slug: "harapan",
          status: "active",
        });
        expect(stored.units).toMatchObject([
          {
            contentLanguage: "id",
            level: "sma",
            name: "SMA Harapan Bangsa",
            npsn: "20100001",
            status: "active",
            tenantId,
            timeZone: "Asia/Jakarta",
          },
          {
            contentLanguage: "id",
            level: "smp",
            name: "SMP Harapan Bangsa",
            status: "active",
            tenantId,
            timeZone: "Asia/Jakarta",
          },
        ]);
        expect(stored.units[1]).not.toHaveProperty("npsn");
        expect(stored.owner).toMatchObject({
          account: { state: "unclaimed" },
          kind: "member",
          name: "Kepala Yayasan",
          status: "active",
          tenantId,
        });
        expect(stored.invite).toMatchObject({
          channel: { email: address, kind: "email" },
          personId: opened.owner,
          state: { status: "pending" },
          tenantId,
        });
        expect(stored.grants).toMatchObject([
          {
            grantedBy: { kind: "system" },
            role: { key: "owner", kind: "builtin" },
            scope: { kind: "tenant" },
            status: "active",
            tenantId,
            term: { kind: "standing" },
          },
        ]);
        const system = { kind: "system" };
        const owner = { id: opened.owner, kind: "person" };
        expect(stored.entries).toMatchObject([
          {
            actor: system,
            change: { contract, type: "tenant.provisioned" },
            owner: { kind: "tenant", tenantId },
            subject: { id: tenantId, kind: "tenant" },
          },
          {
            actor: system,
            change: { type: "unit.created" },
            owner: { kind: "tenant", tenantId },
            subject: { id: opened.units[0], kind: "unit" },
          },
          {
            actor: system,
            change: { type: "unit.created" },
            owner: { kind: "tenant", tenantId },
            subject: { id: opened.units[1], kind: "unit" },
          },
          {
            actor: system,
            change: { type: "person.created" },
            owner: { kind: "tenant", tenantId },
            subject: owner,
          },
          {
            actor: system,
            change: { invite: opened.invite, type: "person.invited" },
            owner: { kind: "tenant", tenantId },
            subject: owner,
          },
          {
            actor: system,
            change: {
              grant: stored.grants[0]?._id,
              role: { key: "owner", kind: "builtin" },
              scope: { kind: "tenant" },
              term: { kind: "standing" },
              type: "grant.created",
            },
            owner: { kind: "tenant", tenantId },
            subject: owner,
          },
        ]);
      })
  );

  it.effect(
    "gives the school a key of its own, written in the same transaction",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const opened = yield* fixture.internal.mutation(
          open,
          request("harapan", [sma, smp])
        );
        const text = yield* fixture.run(
          Effect.gen(function* () {
            const keys = yield* readTenantKeys(opened.tenant);
            const sealed = yield* sealText(keys, nameField, "Kepala Yayasan");
            return yield* openText(keys, nameField, sealed);
          })
        );
        expect(text).toBe("Kepala Yayasan");
      })
  );

  it.effect(
    "opens no school and writes no key while the root keys are missing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const before = yield* fixture.run(counts);
        vi.stubEnv("VAULT_ROOT_KEYS", "");
        const exit = yield* Effect.exit(
          fixture.internal.mutation(open, request("harapan", [sma]))
        );
        expect(Exit.hasDies(exit)).toBe(true);
        expect(yield* fixture.run(counts)).toEqual(before);
      })
  );

  it.effect(
    "starts the invitation email in the language of the first school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const opened = yield* fixture.internal.mutation(
          open,
          request("harapan", [
            { ...smp, contentLanguage: "de", timeZone: "Europe/Berlin" },
            sma,
          ])
        );
        const started = yield* fixture.run(
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            return yield* Effect.promise(() => workflow.list(ctx));
          })
        );
        expect(started.page).toMatchObject([
          {
            args: { inviteId: opened.invite, locale: "de" },
            context: { inviteId: opened.invite },
            name: "emails/invite/workflow:deliverInviteEmail",
          },
        ]);
      })
  );

  it.effect(
    "lets an account that already holds the Owner's address into the new organisation",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account("kepala", address, true);
        yield* fixture.account("lain", stranger, true);
        const opened = yield* fixture.internal.mutation(
          open,
          request("harapan", [sma])
        );
        const jobsNamed = (name: string) =>
          Effect.map(fixture.run(scheduledJobs), (jobs) =>
            Arr.filter(jobs, (job) => job.name === name)
          );
        expect(yield* jobsNamed("tenancy/holders:schedule")).toMatchObject([
          { args: [{ cursor: null, email: address }] },
        ]);
        yield* fixture.internal.mutation(holdersSchedule, {
          cursor: null,
          email: address,
        });
        expect(yield* jobsNamed("tenancy/claims:run")).toMatchObject([
          { args: [{ cursor: null, userId: account.userId }] },
        ]);
        yield* fixture.internal.mutation(claimsRun, {
          cursor: null,
          userId: account.userId,
        });
        const view = yield* account.client.query(viewer, {
          slug: slugOf("harapan"),
        });
        expect(view.person).toMatchObject({
          id: opened.owner,
          kind: "member",
          name: "Kepala Yayasan",
        });
        expect(view.can).toContain("tenant.manage");
        expect(view.grants).toMatchObject([
          {
            role: { key: "owner", kind: "builtin" },
            scope: { kind: "tenant" },
          },
        ]);
      })
  );

  it.effect("schedules no claim while no account holds the address", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.account("lain", stranger, true);
      yield* fixture.internal.mutation(open, request("harapan", [sma]));
      yield* fixture.internal.mutation(holdersSchedule, {
        cursor: null,
        email: address,
      });
      const jobs = Arr.filter(
        yield* fixture.run(scheduledJobs),
        (job) => job.name === "tenancy/claims:run"
      );
      expect(jobs).toEqual([]);
    })
  );

  it("registers opening as an internal function, so no browser can call it", () => {
    expect(Reflect.get(registeredOpen, "isInternal")).toBe(true);
    expect(Reflect.get(registeredOpen, "isPublic")).toBeUndefined();
  });

  it.effect(
    "refuses an address another organisation uses, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const before = yield* fixture.run(counts);
        const taken = yield* fixture.internal
          .mutation(open, request("nf", [sma]))
          .pipe(Effect.flip);
        expect(taken).toMatchObject({
          _tag: "ProvisionRejected",
          code: "SLUG_TAKEN",
        });
        expect(yield* fixture.run(counts)).toEqual(before);
      })
  );

  it.effect("never makes two organisations of one address", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.internal.mutation(open, request("harapan", [sma, smp]));
      const opened = yield* fixture.run(counts);
      const again = yield* fixture.internal
        .mutation(open, request("harapan", [sma, smp]))
        .pipe(Effect.flip);
      expect(again).toMatchObject({ code: "SLUG_TAKEN" });
      expect(yield* fixture.run(counts)).toEqual(opened);
    })
  );

  it.effect("refuses an address that belongs to Nakafa itself", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const before = yield* fixture.run(counts);
      const reserved = yield* fixture.internal
        .mutation(open, request("admin", [sma]))
        .pipe(Effect.flip);
      expect(reserved).toMatchObject({
        _tag: "ProvisionRejected",
        code: "SLUG_RESERVED",
      });
      expect(yield* fixture.run(counts)).toEqual(before);
    })
  );

  it.effect("refuses an organisation with no school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const none = yield* fixture.internal
        .mutation(open, request("harapan", []))
        .pipe(Effect.flip);
      expect(none).toMatchObject({
        _tag: "ProvisionRejected",
        code: "UNIT_REQUIRED",
      });
    })
  );

  it.effect(
    "refuses a contract that enables no module, one module twice, or a version that is not a label",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const noModule: typeof Contract.Type = { ...contract, modules: [] };
        const twice: typeof Contract.Type = {
          ...contract,
          modules: ["exams", "exams"],
        };
        const unreadable: typeof Contract.Type = {
          ...contract,
          dpaVersion: "2026 10",
        };
        const refusals = yield* Effect.forEach(
          [noModule, twice, unreadable],
          (bad) =>
            fixture.internal
              .mutation(open, { ...request("harapan", [sma]), contract: bad })
              .pipe(Effect.flip)
        );
        expect(refusals).toMatchObject(
          Arr.replicate({ _tag: "SchemaError" }, 3)
        );
      })
  );

  it.effect(
    "refuses an organisation, a school, and an Owner whose name runs over a line, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const before = yield* fixture.run(counts);
        const base = request("harapan", [sma]);
        const refusals = yield* Effect.forEach(
          [
            { ...base, name: "Yayasan Harapan\nBangsa" },
            { ...base, units: [{ ...sma, name: "SMA Harapan\r\nBangsa" }] },
            { ...base, owner: { ...base.owner, name: "Kepala\u2028Yayasan" } },
          ],
          (bad) => fixture.internal.mutation(open, bad).pipe(Effect.flip)
        );
        expect(refusals).toMatchObject(
          Arr.replicate({ _tag: "SchemaError" }, 3)
        );
        expect(yield* fixture.run(counts)).toEqual(before);
      })
  );

  it.effect("holds as many schools as the limit and refuses one more", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const school = (index: number): typeof UnitDraft.Type => ({
        ...smp,
        name: `SMP ${index}`,
      });
      const refused = yield* fixture.internal
        .mutation(open, request("harapan", Arr.makeBy(UNIT_LIMIT + 1, school)))
        .pipe(Effect.flip);
      const opened = yield* fixture.internal.mutation(
        open,
        request("harapan", Arr.makeBy(UNIT_LIMIT, school))
      );
      expect(refused).toMatchObject({
        _tag: "ProvisionRejected",
        code: "UNIT_LIMIT",
      });
      expect(opened.units).toHaveLength(UNIT_LIMIT);
    })
  );
});
