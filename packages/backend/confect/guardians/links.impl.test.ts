import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { LINK_TERM } from "@repo/backend/confect/guardians/schema";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { denied, firstPage, nf } from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  IBU,
  linkRow,
  startLink,
} from "@repo/backend/test/guardians";
import {
  actedAt,
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Schema } from "effect";

const { list, revoke, verify } = refs.public.guardians.links;
const AYAH = Schema.decodeSync(Email)("ayah@example.com");

/** The ledger rows of the school, oldest first. */
const ledger = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("guardianConsents").index("by_creation_time").take(20)
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

describe("guardians/links", () => {
  it.effect(
    "lets Staff start a pending link with a new guardian Person and journals it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        vi.setSystemTime(actedAt());
        const link = yield* startLink(fixture);
        expect(link).toMatchObject({
          email: IBU,
          expiresAt: actedAt() + Duration.toMillis(LINK_TERM),
          guardian: { name: "Ibu Siti" },
          mismatches: 0,
          status: "pending",
          student: { id: fixture.people.student.personId, name: "Student" },
        });
        const entries = yield* fixture.run(journal);
        expect(Arr.map(entries, (entry) => entry.change.type)).toEqual(
          expect.arrayContaining(["person.created", "guardian.started"])
        );
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, slug: nf });
        expect(listed.page).toEqual([link]);
      })
  );

  it.effect(
    "reuses the guardian Person of an address, and refuses a second live link to one student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const first = yield* startLink(fixture);
        const again = yield* Effect.flip(startLink(fixture));
        expect(again).toMatchObject({
          _tag: "LinkRefused",
          code: "ALREADY_LINKED",
        });
        yield* fixture
          .as("counselor")
          .mutation(revoke, { linkId: first.id, slug: nf });
        const second = yield* startLink(fixture);
        expect(second.guardian.id).toBe(first.guardian.id);
        expect(second.id).not.toBe(first.id);
      })
  );

  it.effect("refuses a Person who is not an active student", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      const refused = yield* Effect.flip(
        fixture.as("counselor").mutation(refs.public.guardians.links.start, {
          email: IBU,
          guardianName: "Ibu Siti",
          slug: nf,
          studentId: fixture.people.teacher.personId,
        })
      );
      expect(refused).toMatchObject({
        _tag: "LinkRefused",
        code: "NOT_STUDENT",
      });
      const suspended = yield* Effect.flip(
        fixture.as("admin").mutation(refs.public.guardians.links.start, {
          email: IBU,
          guardianName: "Ibu Siti",
          slug: nf,
          studentId: fixture.people.suspended.personId,
        })
      );
      expect(suspended).toMatchObject(denied("condition"));
    })
  );

  it.effect(
    "keeps links to the school's Admin and Staff, and refuses every other role and school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        for (const account of ["teacher", "student", "auditor"] as const) {
          expect(
            yield* Effect.flip(
              fixture.as(account).mutation(refs.public.guardians.links.start, {
                email: AYAH,
                guardianName: "Ayah",
                slug: nf,
                studentId: fixture.people.student.personId,
              })
            )
          ).toMatchObject(denied("role"));
          expect(
            yield* Effect.flip(
              fixture.as(account).query(list, { ...firstPage, slug: nf })
            )
          ).toMatchObject({ _tag: "AccessDenied" });
          expect(
            yield* Effect.flip(
              fixture
                .as(account)
                .mutation(verify, { linkId: link.id, slug: nf })
            )
          ).toMatchObject(denied("role"));
        }
        expect(
          yield* Effect.flip(
            fixture
              .as("otherOwner")
              .mutation(verify, { linkId: link.id, slug: slugOf("other") })
          )
        ).toMatchObject(denied("resource"));
      })
  );

  it.effect(
    "lets Staff check a link by hand, granting consent with the staff method",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        const verified = yield* fixture
          .as("counselor")
          .mutation(verify, { linkId: link.id, slug: nf });
        expect(verified.status).toBe("verified");
        const rows = yield* fixture.run(ledger);
        expect(rows).toEqual([
          expect.objectContaining({
            action: "granted",
            checker: fixture.people.counselor.personId,
            guardianPersonId: link.guardian.id,
            linkId: link.id,
            method: "staff",
            policyVersion: "id-profile-pending-1",
            studentPersonId: fixture.people.student.personId,
          }),
        ]);
        expect(rows[0]).not.toHaveProperty("email");
        const entry = Arr.last(yield* fixture.run(journal));
        expect(entry).toMatchObject({
          _tag: "Some",
          value: {
            change: {
              method: "staff",
              student: fixture.people.student.personId,
              type: "guardian.linked",
            },
          },
        });
        const again = yield* Effect.flip(
          fixture
            .as("counselor")
            .mutation(verify, { linkId: link.id, slug: nf })
        );
        expect(again).toMatchObject({ _tag: "LinkClosed" });
      })
  );

  it.effect(
    "refuses to check a link past its term, which reads as expired",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        vi.setSystemTime(TENANCY_NOW + Duration.toMillis(LINK_TERM) + 1);
        const refused = yield* Effect.flip(
          fixture
            .as("counselor")
            .mutation(verify, { linkId: link.id, slug: nf })
        );
        expect(refused).toMatchObject({ _tag: "LinkClosed" });
        const listed = yield* fixture
          .as("counselor")
          .query(list, { ...firstPage, slug: nf });
        expect(listed.page[0]?.status).toBe("expired");
      })
  );

  it.effect(
    "revokes a link at once, keeps the ledger, and answers an ended link as it stands",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        yield* fixture
          .as("counselor")
          .mutation(verify, { linkId: link.id, slug: nf });
        const revoked = yield* fixture
          .as("admin")
          .mutation(revoke, { linkId: link.id, slug: nf });
        expect(revoked.status).toBe("revoked");
        expect((yield* linkRow(fixture, link.id)).state).toMatchObject({
          reason: "revoked",
          status: "ended",
        });
        expect(yield* fixture.run(ledger)).toHaveLength(1);
        const before = yield* fixture.run(journal);
        const again = yield* fixture
          .as("admin")
          .mutation(revoke, { linkId: link.id, slug: nf });
        expect(again).toEqual(revoked);
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );

  it.effect("clamps a page request into one to one hundred rows", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      yield* startLink(fixture);
      const page = yield* fixture.as("counselor").query(list, {
        paginationOpts: { cursor: null, numItems: 0 },
        slug: nf,
      });
      expect(page.page).toHaveLength(1);
    })
  );
});
