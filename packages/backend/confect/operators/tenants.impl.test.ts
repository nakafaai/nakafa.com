import type { Ref } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { operatorAccount } from "@repo/backend/test/operators";
import {
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option, Order, Record, Schema } from "effect";

const nf = slugOf("nf");
const open = refs.public.operators.tenants.open;
const suspendTenant = refs.public.operators.tenants.suspend;
const reactivateTenant = refs.public.operators.tenants.reactivate;
const replaceOwner = refs.public.operators.tenants.replaceOwner;
const listTenants = refs.public.operators.tenants.list;
const requestVisit = refs.public.operators.visits.request;
const createPerson = refs.public.tenancy.people.create;
const viewer = refs.public.tenancy.viewer.get;
const internalOpen = refs.internal.tenancy.provision.open;
const replacement = Schema.decodeSync(Email)("baru@ganti.example.test");
const claimedReplacement = Schema.decodeSync(Email)(
  "pengganti@nf.example.test"
);
const foreignReplacement = Schema.decodeSync(Email)("baru@lain.example.test");

/** The fields Nakafa staff open an organisation with, for one slug and its first Owner. */
const openRequest = (slug: string, email: string): Ref.Args<typeof open> => ({
  contract: {
    contentLicense: "1.0",
    dpaVersion: "2026-10",
    modules: ["classes", "exams"],
    plan: "tenant",
  },
  country: "ID",
  currency: "IDR",
  kind: "foundation",
  name: `Yayasan ${slug}`,
  owner: { email: Schema.decodeSync(Email)(email), name: "Kepala Yayasan" },
  slug: slugOf(slug),
  units: [
    {
      contentLanguage: "id",
      level: "sma",
      name: "SMA Harapan",
      timeZone: "Asia/Jakarta",
    },
  ],
});

/** Fake timers keep the invitation workflow and the scheduled expiries from starting early. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

describe("operators/tenants open", () => {
  it.effect(
    "opens a school from the console and writes the same rows as the internal command, naming the operator in the journal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "opener");
        const fromConsole = yield* staff.client.mutation(
          open,
          openRequest("harapan", "kepala@harapan.example.test")
        );
        const fromCommand = yield* fixture.internal.mutation(
          internalOpen,
          openRequest("bersama", "kepala@bersama.example.test")
        );
        const entries = yield* fixture.run(journal);
        const typesOf = (kind: "operator" | "system") =>
          Arr.map(
            Arr.filter(entries, (entry) => entry.actor.kind === kind),
            (entry) => entry.change.type
          );
        expect(typesOf("operator")).toEqual(typesOf("system"));
        expect(typesOf("system")).toEqual([
          "tenant.provisioned",
          "unit.created",
          "person.created",
          "person.invited",
          "grant.created",
        ]);
        expect(Arr.sort(Record.keys(fromConsole), Order.String)).toEqual(
          Arr.sort(Record.keys(fromCommand), Order.String)
        );
        expect(Arr.take(entries, 1)).toMatchObject([
          {
            actor: { kind: "operator" },
            change: { type: "tenant.provisioned" },
            subject: { id: fromConsole.tenant, kind: "tenant" },
          },
        ]);
      })
  );

  it.effect(
    "refuses to open a school for a caller who is not an operator",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const denial = yield* fixture
          .as("admin")
          .mutation(open, openRequest("tolak", "kepala@tolak.example.test"))
          .pipe(Effect.flip);
        expect(denial).toMatchObject({ _tag: "NotOperator" });
      })
  );
});

describe("operators/tenants suspend", () => {
  it.effect(
    "suspends a school: its members are refused every write, its reads still work, and reactivation restores it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "pauser");
        const suspended = yield* staff.client.mutation(suspendTenant, {
          tenantId: fixture.tenants.nf,
        });
        expect(suspended).toMatchObject({
          id: fixture.tenants.nf,
          status: "suspended",
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { kind: "operator" },
            change: { type: "tenant.suspended" },
            subject: { id: fixture.tenants.nf, kind: "tenant" },
          },
        ]);
        const refusedAdmin = yield* fixture
          .as("admin")
          .mutation(createPerson, { name: "Ditolak", slug: nf })
          .pipe(Effect.flip);
        const refusedOwner = yield* fixture
          .as("owner")
          .mutation(createPerson, { name: "Ditolak", slug: nf })
          .pipe(Effect.flip);
        expect([refusedAdmin, refusedOwner]).toMatchObject([
          { _tag: "AccessDenied", reason: "condition" },
          { _tag: "AccessDenied", reason: "condition" },
        ]);
        const view = yield* fixture.as("owner").query(viewer, { slug: nf });
        expect(view.tenant.status).toBe("suspended");
        const again = yield* staff.client.mutation(suspendTenant, {
          tenantId: fixture.tenants.nf,
        });
        expect(again).toEqual(suspended);
        expect((yield* fixture.run(journal)).length).toBe(1);
        const restored = yield* staff.client.mutation(reactivateTenant, {
          tenantId: fixture.tenants.nf,
        });
        expect(restored).toMatchObject({ status: "active" });
        const written = yield* fixture.as("admin").mutation(createPerson, {
          name: "Diterima",
          slug: nf,
        });
        expect(written).toMatchObject({ name: "Diterima", status: "active" });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "tenant.suspended" } },
          {
            actor: { kind: "operator" },
            change: { type: "tenant.reactivated" },
            subject: { id: fixture.tenants.nf, kind: "tenant" },
          },
          { change: { type: "person.created" } },
        ]);
      })
  );

  it.effect(
    "refuses to suspend or reactivate a school that does not exist",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "searcher");
        const gone = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const tenantId = yield* writer.table("tenants").insert({
              country: "ID",
              currency: "IDR",
              kind: "school",
              name: "Sekolah Hilang",
              policies: NEW_TENANT_POLICIES,
              slug: slugOf("lenyap"),
              status: "active",
            });
            yield* writer.table("tenants").delete(tenantId);
            return tenantId;
          })
        );
        const suspendDenial = yield* staff.client
          .mutation(suspendTenant, { tenantId: gone })
          .pipe(Effect.flip);
        const reactivateDenial = yield* staff.client
          .mutation(reactivateTenant, { tenantId: gone })
          .pipe(Effect.flip);
        expect([suspendDenial._tag, reactivateDenial._tag]).toEqual([
          "TenantNotFound",
          "TenantNotFound",
        ]);
      })
  );
});

describe("operators/tenants reactivate", () => {
  it.effect("returns an active school as it is when it is reactivated", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const staff = yield* operatorAccount(fixture, "steady");
      const active = yield* staff.client.mutation(reactivateTenant, {
        tenantId: fixture.tenants.nf,
      });
      expect(active).toMatchObject({
        id: fixture.tenants.nf,
        status: "active",
      });
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );
});

describe("operators/tenants replaceOwner", () => {
  it.effect(
    "replaces the unclaimed Owner of a school, with its invite, and journals each step as a break-glass",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "replacer");
        const opened = yield* fixture.internal.mutation(
          internalOpen,
          openRequest("ganti", "lama@ganti.example.test")
        );
        const row = yield* staff.client.mutation(replaceOwner, {
          locale: "id",
          owner: { email: replacement, name: "Kepala Baru" },
          tenantId: opened.tenant,
        });
        expect(row).toMatchObject({ id: opened.tenant, status: "active" });
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            Effect.all({
              invites: reader
                .table("tenantInvites")
                .index("by_tenantId_and_state_status", (query) =>
                  query.eq("tenantId", opened.tenant)
                )
                .take(10),
              people: reader
                .table("tenantPeople")
                .index("by_tenantId_and_status", (query) =>
                  query.eq("tenantId", opened.tenant)
                )
                .take(10),
            })
          )
        );
        const oldOwner = Option.getOrThrow(
          Arr.findFirst(stored.people, (person) => person._id === opened.owner)
        );
        expect(oldOwner).toMatchObject({
          account: { state: "unclaimed" },
          status: "removed",
        });
        // Invites are read in state order: a pending one comes before a revoked one.
        expect(
          Arr.map(stored.invites, (invite) => [
            invite.channel.email,
            invite.state,
          ])
        ).toEqual([
          ["baru@ganti.example.test", { status: "pending" }],
          ["lama@ganti.example.test", { at: TENANCY_NOW, status: "revoked" }],
        ]);
        const entries = yield* fixture.run(journal);
        expect(Arr.takeRight(entries, 6)).toMatchObject([
          {
            actor: { kind: "operator" },
            change: { reason: "replaced", type: "grant.ended" },
            subject: { id: opened.owner, kind: "person" },
          },
          { change: { type: "invite.revoked" } },
          {
            change: { reason: "break-glass", type: "person.removed" },
            subject: { id: opened.owner, kind: "person" },
          },
          { change: { type: "person.created" } },
          { change: { reason: "break-glass", type: "person.invited" } },
          { change: { role: { key: "owner" }, type: "grant.created" } },
        ]);
      })
  );

  it.effect(
    "refuses to replace the Owner of a school that a signed-in Owner holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "claimed");
        const denial = yield* staff.client
          .mutation(replaceOwner, {
            locale: "id",
            owner: { email: claimedReplacement, name: "Pengganti" },
            tenantId: fixture.tenants.nf,
          })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({
          _tag: "OwnerClaimed",
          code: "OWNER_CLAIMED",
        });
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );

  it.effect(
    "refuses an Owner address the school's allowed domains do not admit, before it removes anything",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "domained");
        const opened = yield* fixture.internal.mutation(
          internalOpen,
          openRequest("domain", "lama@domain.example.test")
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenants").patch(opened.tenant, {
              policies: {
                emailDomains: ["domain.example.test"],
                nina: false,
                studentThreads: false,
              },
            })
          )
        );
        const denial = yield* staff.client
          .mutation(replaceOwner, {
            locale: "id",
            owner: { email: foreignReplacement, name: "Asing" },
            tenantId: opened.tenant,
          })
          .pipe(Effect.flip);
        expect(denial).toMatchObject({ _tag: "InviteDomainRefused" });
        const stillOwner = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(opened.owner)
          )
        );
        expect(stillOwner.status).toBe("active");
      })
  );
});

describe("operators/tenants list", () => {
  it.effect(
    "lists every school with its units and the operator's open visit, and no person of any school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "catalog");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Katalog",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        const page = yield* staff.client.query(listTenants, {
          paginationOpts: { cursor: null, numItems: 50 },
        });
        const rows = Arr.map(page.page, (row) => [
          row.slug,
          row.unitCount,
          row.visit?.id,
        ]);
        expect(rows).toEqual(
          expect.arrayContaining([
            ["nf", 3, visit.id],
            ["other", 1, undefined],
          ])
        );
        const nfRow = Option.getOrThrow(
          Arr.findFirst(page.page, (row) => row.slug === "nf")
        );
        expect(nfRow).toMatchObject({
          kind: "foundation",
          name: "Yayasan Nakafa",
          status: "active",
          visit: { state: { status: "pending" } },
        });
        // A row carries the school's metadata, its unit count, and the visit, and nothing else.
        expect(Arr.sort(Record.keys(nfRow), Order.String)).toEqual([
          "id",
          "kind",
          "name",
          "slug",
          "status",
          "unitCount",
          "visit",
        ]);
      })
  );

  it.effect("refuses the directory to a school's own Owner", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denial = yield* fixture
        .as("owner")
        .query(listTenants, {
          paginationOpts: { cursor: null, numItems: 50 },
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({ _tag: "NotOperator" });
    })
  );
});
