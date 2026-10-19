import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  grantRole,
  invitePerson,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

const other = slugOf("other");
const nf = slugOf("nf");
const { setup } = refs.public.tenancy.home;
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const lain = Schema.decodeSync(Email)("lain@lain.example.test");

describe("tenancy/home setup", () => {
  it.effect(
    "reports a school with no teacher, no student, and no invite as missing all three",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;

        const read = yield* fixture
          .as("otherOwner")
          .query(setup, { slug: other });

        expect(read).toEqual({
          hasPendingInvite: false,
          hasStudent: false,
          hasTeacher: false,
        });
      })
  );

  it.effect(
    "reports the teacher and the student that the seeded school holds, and no invite",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;

        const read = yield* fixture.as("owner").query(setup, { slug: nf });

        expect(read).toEqual({
          hasPendingInvite: false,
          hasStudent: true,
          hasTeacher: true,
        });
      })
  );

  it.effect("reports an invite that waits to be accepted", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(invitePerson(fixture.tenants.other, guru));

      const read = yield* fixture
        .as("otherOwner")
        .query(setup, { slug: other });

      expect(read).toMatchObject({ hasPendingInvite: true });
    })
  );

  it.effect(
    "counts a grant of a role that is active, and ignores a revoked grant and a revoked invite",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { personId } = yield* fixture.run(
          invitePerson(fixture.tenants.other, lain, {
            invite: { at: TENANCY_NOW, status: "revoked" },
          })
        );
        yield* fixture.run(
          grantRole(fixture.tenants.other, personId, "student", {
            kind: "tenant",
          })
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantGrants").insert({
              grantedBy: { kind: "system" },
              personId,
              role: { key: "teacher", kind: "builtin" },
              scope: { kind: "tenant" },
              status: "revoked",
              tenantId: fixture.tenants.other,
              term: { kind: "standing" },
            })
          ).pipe(Effect.orDie)
        );

        const read = yield* fixture
          .as("otherOwner")
          .query(setup, { slug: other });

        expect(read).toEqual({
          hasPendingInvite: false,
          hasStudent: true,
          hasTeacher: false,
        });
      })
  );

  it.effect("refuses a teacher, who may not manage the school's setup", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;

      const denial = yield* fixture
        .as("teacher")
        .query(setup, { slug: nf })
        .pipe(Effect.flip);

      expect(denial).toMatchObject({
        _tag: "AccessDenied",
        code: "ACCESS_DENIED",
      });
    })
  );
});
