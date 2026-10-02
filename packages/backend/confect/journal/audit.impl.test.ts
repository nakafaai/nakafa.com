import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  type Actor,
  ChangeView,
  SubjectView,
} from "@repo/backend/confect/journal/schema";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option, Schema } from "effect";

const nf = slugOf("nf");
const audit = refs.public.journal.audit.list;
const page = (numItems: number) => ({
  paginationOpts: { cursor: null, numItems },
  slug: nf,
});

/** Inserts `count` provisioning entries for one tenant the way an authority files them. */
const provisioned = Effect.fn("test.audit.provisioned")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  count: number,
  actor: typeof Actor.Type
) {
  const writer = yield* DatabaseWriter;
  return yield* Effect.forEach(Arr.range(1, count), () =>
    writer.table("journalEntries").insert({
      actor,
      change: { type: "tenant.provisioned" },
      owner: { kind: "tenant", tenantId },
      subject: { id: tenantId, kind: "tenant" },
    })
  );
});

describe("journal/audit list", () => {
  it.effect(
    "shows the member tenant's changes newest first with Person names",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(
          provisioned(fixture.tenants.other, 2, { kind: "system" })
        );
        yield* fixture.run(
          provisioned(fixture.tenants.nf, 1, { kind: "system" })
        );
        yield* fixture.run(
          provisioned(fixture.tenants.nf, 1, {
            id: fixture.users.owner.userId,
            kind: "user",
          })
        );
        const owner = fixture.as("owner");
        const grantId = yield* owner.mutation(
          refs.public.access.grants.assign,
          {
            personId: fixture.people.student.personId,
            role: "proctor",
            scope: { kind: "tenant" },
            slug: nf,
          }
        );
        yield* owner.mutation(refs.public.access.grants.revoke, {
          grantId,
          slug: nf,
        });
        const result = yield* owner.query(audit, page(10));
        const actor = {
          id: fixture.people.owner.personId,
          kind: "person",
          name: "Owner",
        };
        const subject = { id: fixture.people.student.personId, kind: "person" };
        const tenant = { id: fixture.tenants.nf, kind: "tenant" };
        expect(result.page).toMatchObject([
          {
            actor,
            change: { grant: grantId, reason: "revoked", type: "grant.ended" },
            subject,
            subjectName: Option.some("Student"),
          },
          {
            actor,
            change: { grant: grantId, type: "grant.created" },
            subject,
            subjectName: Option.some("Student"),
          },
          {
            actor: { kind: "user" },
            change: { type: "tenant.provisioned" },
            subject: tenant,
            subjectName: Option.none(),
          },
          {
            actor: { kind: "system" },
            change: { type: "tenant.provisioned" },
            subject: tenant,
            subjectName: Option.none(),
          },
        ]);
        expect(result.isDone).toBe(true);
      })
  );

  it.effect("reads at most 100 entries per page", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(
        provisioned(fixture.tenants.nf, 101, { kind: "system" })
      );
      const result = yield* fixture.as("auditor").query(audit, page(500));
      expect(result.page).toHaveLength(100);
      expect(result.isDone).toBe(false);
    })
  );

  it.effect(
    "keeps the log from teachers, unit-scoped principals, and other tenants",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const denials = yield* Effect.forEach(
          ["teacher", "principal", "otherOwner"] as const,
          (account) =>
            fixture.as(account).query(audit, page(10)).pipe(Effect.flip)
        );
        expect(denials).toMatchObject([
          { _tag: "AccessDenied", action: "audit.view", reason: "role" },
          { _tag: "AccessDenied", action: "audit.view", reason: "role" },
          { _tag: "NotMember" },
        ]);
      })
  );

  it("lets an older client read change types and kinds added after it was built", () => {
    expect(
      Schema.decodeUnknownSync(ChangeView)({ seat: 3, type: "seat.added" })
    ).toEqual({ type: "unknown" });
    expect(
      Schema.decodeUnknownSync(SubjectView)({ id: "id", kind: "cohort" })
    ).toEqual({ kind: "unknown" });
  });
});
