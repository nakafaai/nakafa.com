import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { endGrant } from "@repo/backend/confect/access/grant";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { assignTemporaryRole } from "@repo/backend/confect/access/temporary";
import type {
  PersonKind,
  PersonStatus,
} from "@repo/backend/confect/tenancy/schema";
import {
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const insertPerson = Effect.fn("test.temporary.insertPerson")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  kind: typeof PersonKind.Type,
  status: typeof PersonStatus.Type
) {
  const reader = yield* DatabaseReader;
  const id = yield* (yield* DatabaseWriter).table("tenantPeople").insert({
    account: { state: "unclaimed" },
    kind,
    name: "Staf",
    status,
    tenantId,
  });
  return yield* reader.table("tenantPeople").get(id);
});

describe("access/temporary assignTemporaryRole", () => {
  it.effect(
    "gives an operator a temporary role that ends at its term, and refuses every other temporary grant",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { nf } = fixture.tenants;
        const expiresAt = TENANCY_NOW + 60 * 60 * 1000;
        const visitor = yield* fixture.run(
          insertPerson(nf, "operator", "active")
        );
        const suspended = yield* fixture.run(
          insertPerson(nf, "operator", "suspended")
        );
        const member = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(fixture.people.teacher.personId)
          )
        );
        // The refusal's code, since a typed error is not a value the fixture returns.
        const refusal = (holder: typeof visitor, role: BuiltinRole) =>
          fixture.run(
            assignTemporaryRole(
              { kind: "system" },
              holder,
              role,
              { kind: "tenant" },
              expiresAt
            ).pipe(
              Effect.flip,
              Effect.map((error) => error.code)
            )
          );
        expect([
          yield* refusal(member, "auditor"),
          yield* refusal(suspended, "auditor"),
          yield* refusal(visitor, "integration"),
          yield* refusal(visitor, "owner"),
          yield* refusal(visitor, "admin"),
        ]).toEqual([
          "PERSON_KIND",
          "PERSON_INACTIVE",
          "GRANT_ROLE",
          "TEMPORARY_ROLE",
          "TEMPORARY_ROLE",
        ]);
        const grantId = yield* fixture.run(
          assignTemporaryRole(
            { kind: "system" },
            visitor,
            "auditor",
            { kind: "tenant" },
            expiresAt
          )
        );
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantGrants").get(grantId)
          )
        );
        expect(stored).toMatchObject({
          personId: visitor._id,
          role: { key: "auditor", kind: "builtin" },
          status: "active",
          term: { expiresAt, kind: "temporary" },
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { kind: "system" },
            change: {
              grant: grantId,
              term: { expiresAt, kind: "temporary" },
              type: "grant.created",
            },
            subject: { id: visitor._id, kind: "person" },
          },
        ]);
      })
  );

  it.effect(
    "records a visit grant that the operator left under its reason",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { nf } = fixture.tenants;
        const visitor = yield* fixture.run(
          insertPerson(nf, "operator", "active")
        );
        const grantId = yield* fixture.run(
          assignTemporaryRole(
            { kind: "system" },
            visitor,
            "auditor",
            { kind: "tenant" },
            TENANCY_NOW + 60 * 60 * 1000
          )
        );
        const grantDoc = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantGrants").get(grantId)
          )
        );
        yield* fixture.run(
          endGrant({ kind: "system" }, grantDoc, visitor, "left")
        );
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantGrants").get(grantId)
          )
        );
        expect(stored.status).toBe("revoked");
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "grant.created" } },
          {
            change: { grant: grantId, reason: "left", type: "grant.ended" },
            subject: { id: visitor._id, kind: "person" },
          },
        ]);
      })
  );
});
