import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { LINK_TERM } from "@repo/backend/confect/guardians/schema";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { denied, firstPage, nf } from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  IBU,
  linkRow,
  signInGuardian,
  startLink,
} from "@repo/backend/test/guardians";
import {
  actedAt,
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Schema } from "effect";

const { list, readdress, revoke, verify } = refs.public.guardians.links;
const AYAH = Schema.decodeSync(Email)("ayah@example.com");
const BUNDA = Schema.decodeSync(Email)("bunda@example.com");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

describe("guardians/readdress", () => {
  it.effect(
    "corrects a pending link's address in place: its term and its guardian stay, its failed checks count again, and the change is journaled",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        vi.setSystemTime(actedAt());
        const link = yield* startLink(fixture);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("guardianLinks").patch(link.id, { mismatches: 2 })
          )
        );
        vi.setSystemTime(actedAt(30));
        const corrected = yield* fixture
          .as("counselor")
          .mutation(readdress, { email: AYAH, linkId: link.id, slug: nf });
        expect(corrected).toEqual({
          ...link,
          email: AYAH,
          mismatches: 0,
        });
        expect(corrected.expiresAt).toBe(
          actedAt() + Duration.toMillis(LINK_TERM)
        );
        expect(Arr.last(yield* fixture.run(journal))).toMatchObject({
          _tag: "Some",
          value: {
            change: {
              guardian: link.guardian.id,
              student: fixture.people.student.personId,
              type: "guardian.readdressed",
            },
            subject: { id: link.id, kind: "guardianLink" },
          },
        });
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, slug: nf });
        expect(listed.page).toEqual([corrected]);

        // The same address again answers the link as it stands and journals nothing.
        const before = yield* fixture.run(journal);
        expect(
          yield* fixture
            .as("admin")
            .mutation(readdress, { email: AYAH, linkId: link.id, slug: nf })
        ).toEqual(corrected);
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );

  it.effect(
    "joins the guardian of an address that already has a link at the school, so one address stays one Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const earlier = yield* startLink(fixture, AYAH);
        yield* fixture
          .as("counselor")
          .mutation(revoke, { linkId: earlier.id, slug: nf });
        const link = yield* startLink(fixture);
        expect(link.guardian.id).not.toBe(earlier.guardian.id);
        const corrected = yield* fixture
          .as("counselor")
          .mutation(readdress, { email: AYAH, linkId: link.id, slug: nf });
        expect(corrected.guardian).toEqual(earlier.guardian);
        expect((yield* linkRow(fixture, link.id)).guardianPersonId).toBe(
          earlier.guardian.id
        );
      })
  );

  it.effect(
    "gives the link a new guardian Person once someone signed in with the old address, or the guardian holds another link",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const signedIn = yield* startLink(fixture);
        yield* signInGuardian(fixture);
        const moved = yield* fixture
          .as("counselor")
          .mutation(readdress, { email: AYAH, linkId: signedIn.id, slug: nf });
        expect(moved.guardian.id).not.toBe(signedIn.guardian.id);
        expect(moved.guardian.name).toBe(signedIn.guardian.name);
        expect(Arr.last(yield* fixture.run(journal))).toMatchObject({
          _tag: "Some",
          value: { change: { type: "guardian.readdressed" } },
        });

        // An unclaimed guardian who holds an ended link too keeps that link, and the corrected one moves on.
        yield* fixture
          .as("counselor")
          .mutation(revoke, { linkId: moved.id, slug: nf });
        const first = yield* startLink(fixture, AYAH);
        yield* fixture
          .as("counselor")
          .mutation(revoke, { linkId: first.id, slug: nf });
        const second = yield* startLink(fixture, AYAH);
        expect(second.guardian.id).toBe(first.guardian.id);
        const split = yield* fixture.as("counselor").mutation(readdress, {
          email: BUNDA,
          linkId: second.id,
          slug: nf,
        });
        expect(split.guardian.id).not.toBe(first.guardian.id);
      })
  );

  it.effect(
    "refuses an address that has a live link to the same student, a verified or expired link, and an ended one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        const other = yield* startLink(fixture, AYAH);
        expect(
          yield* Effect.flip(
            fixture
              .as("counselor")
              .mutation(readdress, { email: AYAH, linkId: link.id, slug: nf })
          )
        ).toMatchObject({ _tag: "LinkRefused", code: "ALREADY_LINKED" });
        yield* fixture
          .as("counselor")
          .mutation(verify, { linkId: link.id, slug: nf });
        expect(
          yield* Effect.flip(
            fixture
              .as("counselor")
              .mutation(readdress, { email: BUNDA, linkId: link.id, slug: nf })
          )
        ).toMatchObject({ _tag: "LinkClosed" });
        vi.setSystemTime(TENANCY_NOW + Duration.toMillis(LINK_TERM) + 1);
        expect(
          yield* Effect.flip(
            fixture
              .as("counselor")
              .mutation(readdress, { email: BUNDA, linkId: other.id, slug: nf })
          )
        ).toMatchObject({ _tag: "LinkClosed" });
        // An ended link is locked, so its access refuses every write before the correction reads it.
        yield* fixture
          .as("counselor")
          .mutation(revoke, { linkId: link.id, slug: nf });
        expect(
          yield* Effect.flip(
            fixture
              .as("counselor")
              .mutation(readdress, { email: BUNDA, linkId: link.id, slug: nf })
          )
        ).toMatchObject(denied("condition"));
        expect((yield* linkRow(fixture, link.id)).email).toBe(IBU);
        expect((yield* linkRow(fixture, other.id)).email).toBe(AYAH);
      })
  );

  it.effect("keeps the correction to the school's Admin and Staff", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      const link = yield* startLink(fixture);
      for (const account of ["teacher", "student", "auditor"] as const) {
        expect(
          yield* Effect.flip(
            fixture
              .as(account)
              .mutation(readdress, { email: AYAH, linkId: link.id, slug: nf })
          )
        ).toMatchObject(denied("role"));
      }
    })
  );
});
