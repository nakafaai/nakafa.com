import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  journal,
  slugOf,
  suspend,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { sha256Hex } from "@repo/utilities/digest";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { create, list, revoke, rotate } = refs.public.integrations.clients;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const notMember = { _tag: "NotMember", code: "NOT_MEMBER" };
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

/** One stored client, read inside the fixture. */
const stored = (clientId: GenericId.GenericId<"integrationClients">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("integrationClients").get(clientId).pipe(Effect.orDie)
  );

/** Stores `count` active clients of the school directly, so a list has more rows than one page. */
const seedClients = (tenantId: GenericId.GenericId<"tenants">, count: number) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    Effect.forEach(Arr.range(1, count), () =>
      writer.table("integrationClients").insert({
        actions: ["person.view"],
        name: "Sinkron Harapan",
        revokedAt: null,
        rotatedAt: TENANCY_NOW,
        scope: { kind: "tenant" },
        secretHash: "0".repeat(64),
        status: "active",
        tenantId,
      })
    )
  );

describe("integrations/clients create", () => {
  it.effect(
    "registers a school client, returns its secret once, and stores only its digest",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("admin").mutation(create, {
          actions: ["person.view", "cohort.view"],
          name: "Sinkron Harapan",
          scope: { kind: "tenant" },
          slug: nf,
        });
        const row = yield* fixture.run(stored(made.id));
        expect(made).toEqual({
          id: expect.any(String),
          secret: expect.any(String),
        });
        expect(row).toMatchObject({
          actions: ["person.view", "cohort.view"],
          name: "Sinkron Harapan",
          revokedAt: null,
          scope: { kind: "tenant" },
          status: "active",
          tenantId: fixture.tenants.nf,
        });
        expect(row.secretHash).toBe(yield* sha256Hex(made.secret));
        expect(row.secretHash).not.toBe(made.secret);
      })
  );

  it.effect("journals the registration with IDs and enums only", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture.as("admin").mutation(create, {
        actions: ["person.view"],
        name: "Sinkron Harapan",
        scope: { kind: "tenant" },
        slug: nf,
      });
      const entries = yield* fixture.run(journal);
      expect(entries).toMatchObject([
        {
          actor: { id: fixture.people.admin.personId, kind: "person" },
          subject: { id: made.id, kind: "integration" },
        },
      ]);
      expect(Arr.map(entries, (entry) => entry.change)).toEqual([
        {
          client: made.id,
          scope: { kind: "tenant" },
          type: "integration.created",
        },
      ]);
    })
  );

  it.effect(
    "refuses an action list that names an action the catalog does not open to a client",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const refused = yield* fixture
          .as("admin")
          .mutation(create, {
            actions: ["person.view", "person.manage"],
            name: "Sinkron Harapan",
            scope: { kind: "tenant" },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "ActionClosed",
          code: "ACTION_CLOSED",
        });
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );

  it.effect(
    "lets a unit's Admin register a client of that unit only, and refuses a tenant client to them",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { sma, smp } = fixture.units;
        const unitClient = yield* fixture.as("unitAdmin").mutation(create, {
          actions: ["person.view"],
          name: "Sinkron SMP",
          scope: { kind: "unit", unitId: smp },
          slug: nf,
        });
        const otherUnit = yield* fixture
          .as("unitAdmin")
          .mutation(create, {
            actions: ["person.view"],
            name: "Sinkron SMA",
            scope: { kind: "unit", unitId: sma },
            slug: nf,
          })
          .pipe(Effect.flip);
        const tenantWide = yield* fixture
          .as("unitAdmin")
          .mutation(create, {
            actions: ["person.view"],
            name: "Sinkron Sekolah",
            scope: { kind: "tenant" },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(unitClient.id).toEqual(expect.any(String));
        expect([otherUnit, tenantWide]).toMatchObject([
          denied("role"),
          denied("role"),
        ]);
      })
  );

  it.effect(
    "refuses a create by a teacher, and any create in a suspended school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = yield* fixture
          .as("teacher")
          .mutation(create, {
            actions: ["person.view"],
            name: "Sinkron Harapan",
            scope: { kind: "tenant" },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(teacher).toMatchObject(denied("role"));
        yield* fixture.run(suspend(fixture.tenants.nf));
        const suspended = yield* fixture
          .as("admin")
          .mutation(create, {
            actions: ["person.view"],
            name: "Sinkron Harapan",
            scope: { kind: "tenant" },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(suspended).toMatchObject(denied("condition"));
      })
  );
});

describe("integrations/clients list", () => {
  it.effect("lists the school's clients without any secret digest", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture.as("admin").mutation(create, {
        actions: ["person.view"],
        name: "Sinkron Harapan",
        scope: { kind: "tenant" },
        slug: nf,
      });
      const listed = yield* fixture
        .as("admin")
        .query(list, { ...firstPage, slug: nf });
      expect(listed.page).toEqual([
        {
          actions: ["person.view"],
          createdAt: expect.any(Number),
          id: made.id,
          name: "Sinkron Harapan",
          revokedAt: null,
          rotatedAt: expect.any(Number),
          scope: { kind: "tenant" },
          status: "active",
        },
      ]);
      expect(listed.page[0]).not.toHaveProperty("secretHash");
    })
  );

  it.effect(
    "clamps a page size below one, or above 100 rows, into that range",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(seedClients(fixture.tenants.nf, 101));
        const sizes = yield* Effect.forEach([0, -3, 500], (numItems) =>
          fixture
            .as("admin")
            .query(list, {
              paginationOpts: { cursor: null, numItems },
              slug: nf,
            })
            .pipe(Effect.map((listed) => listed.page.length))
        );
        expect(sizes).toEqual([1, 1, 100]);
      })
  );

  it.effect("refuses the list to a teacher and to another school's Owner", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = yield* fixture
        .as("teacher")
        .query(list, { ...firstPage, slug: nf })
        .pipe(Effect.flip);
      const stranger = yield* fixture
        .as("otherOwner")
        .query(list, { ...firstPage, slug: nf })
        .pipe(Effect.flip);
      expect([teacher, stranger]).toMatchObject([denied("role"), notMember]);
    })
  );
});

describe("integrations/clients rotate and revoke", () => {
  it.effect(
    "rotates a secret: the old digest is replaced, and the new secret is returned once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("admin").mutation(create, {
          actions: ["person.view"],
          name: "Sinkron Harapan",
          scope: { kind: "tenant" },
          slug: nf,
        });
        const before = yield* fixture.run(stored(made.id));
        const rotated = yield* fixture
          .as("admin")
          .mutation(rotate, { clientId: made.id, slug: nf });
        const after = yield* fixture.run(stored(made.id));
        expect(rotated).toEqual({ id: made.id, secret: expect.any(String) });
        expect(rotated.secret).not.toBe(made.secret);
        expect(after.secretHash).toBe(yield* sha256Hex(rotated.secret));
        expect(after.secretHash).not.toBe(before.secretHash);
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "integration.created" } },
          {
            change: { client: made.id, type: "integration.rotated" },
            subject: { id: made.id, kind: "integration" },
          },
        ]);
      })
  );

  it.effect("lets a unit's Admin rotate and revoke a client of that unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture.as("unitAdmin").mutation(create, {
        actions: ["person.view"],
        name: "Sinkron SMP",
        scope: { kind: "unit", unitId: fixture.units.smp },
        slug: nf,
      });
      const rotated = yield* fixture
        .as("unitAdmin")
        .mutation(rotate, { clientId: made.id, slug: nf });
      const revoked = yield* fixture
        .as("unitAdmin")
        .mutation(revoke, { clientId: made.id, slug: nf });
      expect(rotated.secret).not.toBe(made.secret);
      expect(revoked).toBeNull();
      expect((yield* fixture.run(stored(made.id))).status).toBe("revoked");
    })
  );

  it.effect("refuses to rotate a revoked client, and refuses a teacher", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture.as("admin").mutation(create, {
        actions: ["person.view"],
        name: "Sinkron Harapan",
        scope: { kind: "tenant" },
        slug: nf,
      });
      const teacher = yield* fixture
        .as("teacher")
        .mutation(rotate, { clientId: made.id, slug: nf })
        .pipe(Effect.flip);
      yield* fixture
        .as("admin")
        .mutation(revoke, { clientId: made.id, slug: nf });
      const revoked = yield* fixture
        .as("admin")
        .mutation(rotate, { clientId: made.id, slug: nf })
        .pipe(Effect.flip);
      expect([teacher, revoked]).toMatchObject([
        denied("role"),
        denied("condition"),
      ]);
    })
  );

  it.effect(
    "revokes a client, deletes its digest, and keeps a retried revoke a no-op",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("admin").mutation(create, {
          actions: ["person.view"],
          name: "Sinkron Harapan",
          scope: { kind: "tenant" },
          slug: nf,
        });
        const first = yield* fixture
          .as("admin")
          .mutation(revoke, { clientId: made.id, slug: nf });
        const retried = yield* fixture
          .as("admin")
          .mutation(revoke, { clientId: made.id, slug: nf });
        const row = yield* fixture.run(stored(made.id));
        expect([first, retried]).toEqual([null, null]);
        expect(row).toMatchObject({
          revokedAt: expect.any(Number),
          secretHash: null,
          status: "revoked",
        });
        expect(
          Arr.map(yield* fixture.run(journal), (entry) => entry.change.type)
        ).toEqual(["integration.created", "integration.revoked"]);
      })
  );

  it.effect("refuses a revoke by a teacher, and leaves the client active", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture.as("admin").mutation(create, {
        actions: ["person.view"],
        name: "Sinkron Harapan",
        scope: { kind: "tenant" },
        slug: nf,
      });
      const refused = yield* fixture
        .as("teacher")
        .mutation(revoke, { clientId: made.id, slug: nf })
        .pipe(Effect.flip);
      const row = yield* fixture.run(stored(made.id));
      expect(refused).toMatchObject(denied("role"));
      expect(row.status).toBe("active");
    })
  );
});
