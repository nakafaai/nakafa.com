import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const nf = slugOf("nf");
const { change, revoke } = refs.public.access.grants;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const rejected = (code: string) => ({ _tag: "GrantRejected", code });

describe("access/grants change", () => {
  it.effect(
    "changes a role in one step over the same scope, and journals both halves",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { grantId, personId } = fixture.people.teacher;
        const next = yield* fixture
          .as("owner")
          .mutation(change, { grantId, role: "counselor", slug: nf });
        const { after, before, entries } = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            return {
              after: yield* reader.table("tenantGrants").get(next),
              before: yield* reader.table("tenantGrants").get(grantId),
              entries: yield* reader
                .table("journalEntries")
                .index("by_creation_time")
                .take(10),
            };
          })
        );
        expect(before.status).toBe("revoked");
        expect(after).toMatchObject({
          personId,
          role: { key: "counselor" },
          scope: before.scope,
          status: "active",
        });
        expect(entries).toMatchObject([
          { change: { grant: grantId, type: "grant.ended" } },
          { change: { grant: next, type: "grant.created" } },
        ]);
      })
  );

  it.effect(
    "leaves the grant as it was when either half is refused, and refuses an ended grant",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const { grantId } = fixture.people.teacher;
        const refusals = [
          yield* owner
            .mutation(change, {
              grantId: fixture.people.owner.grantId,
              role: "teacher",
              slug: nf,
            })
            .pipe(Effect.flip),
          yield* fixture
            .as("admin")
            .mutation(change, { grantId, role: "admin", slug: nf })
            .pipe(Effect.flip),
          yield* owner
            .mutation(change, { grantId, role: "integration", slug: nf })
            .pipe(Effect.flip),
        ];
        expect(refusals).toMatchObject([
          rejected("LAST_OWNER"),
          denied("role"),
          { _tag: "GrantRejected" },
        ]);
        const kept = yield* fixture.run(
          Effect.gen(function* () {
            return yield* (yield* DatabaseReader)
              .table("tenantGrants")
              .get(grantId);
          })
        );
        expect(kept.status).toBe("active");
        yield* owner.mutation(revoke, { grantId, slug: nf });
        const ended = yield* owner
          .mutation(change, { grantId, role: "counselor", slug: nf })
          .pipe(Effect.flip);
        expect(ended).toMatchObject(denied("resource"));
      })
  );
});
