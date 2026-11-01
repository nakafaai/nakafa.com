import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { nf } from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  type Fixture,
  NISN,
  setRoster,
  signInGuardian,
  startLink,
} from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { answer, ask, ofLink, waiting } = refs.public.guardians.requests;
const firstPage = { paginationOpts: { cursor: null, numItems: 50 } };
const { confirm } = refs.public.guardians.family;

/** A parent with a verified link to the student. */
const verified = Effect.fn("test.guardians.requests.verified")(function* (
  fixture: Fixture
) {
  yield* asStaffSchool(fixture);
  yield* setRoster(fixture, NISN);
  const link = yield* startLink(fixture);
  const { client } = yield* signInGuardian(fixture);
  yield* client.mutation(confirm, { linkId: link.id, nisn: NISN, slug: nf });
  return { guardian: client, linkId: link.id };
});

describe("guardians/requests", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "takes a parent's request to the school office, and shows them the answer",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { guardian, linkId } = yield* verified(fixture);
        const staff = fixture.as("admin");

        yield* guardian.mutation(ask, {
          kind: "reportCopy",
          linkId,
          slug: nf,
          text: "Salinan rapor semester lalu.",
        });
        const listed = (yield* staff.query(waiting, { ...firstPage, slug: nf }))
          .page;
        expect(listed).toMatchObject([
          {
            kind: "reportCopy",
            linkId,
            state: "waiting",
            text: "Salinan rapor semester lalu.",
          },
        ]);
        const requestId = listed[0]?.id;
        if (requestId === undefined) {
          return yield* Effect.die("The request is listed.");
        }

        const names = { linkId, requestId, slug: nf };
        yield* staff.mutation(answer, { ...names, decision: "approved" });
        yield* staff.mutation(answer, { ...names, decision: "declined" });

        expect(
          (yield* staff.query(waiting, { ...firstPage, slug: nf })).page
        ).toEqual([]);
        expect(
          yield* guardian.query(ofLink, { linkId, slug: nf })
        ).toMatchObject([{ state: "approved" }]);
      })
  );

  it.effect("keeps a parent from answering their own request", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { guardian, linkId } = yield* verified(fixture);
      yield* guardian.mutation(ask, {
        kind: "dataCorrection",
        linkId,
        slug: nf,
        text: "Nama ejaannya salah.",
      });
      const listed = (yield* fixture
        .as("admin")
        .query(waiting, { ...firstPage, slug: nf })).page;
      const requestId = listed[0]?.id;
      if (requestId === undefined) {
        return yield* Effect.die("The request is listed.");
      }
      expect(
        yield* guardian
          .mutation(answer, {
            decision: "approved",
            linkId,
            requestId,
            slug: nf,
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "AccessDenied" });
    })
  );

  it.effect("refuses a parent whose link is not verified", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      const link = yield* startLink(fixture);
      const { client } = yield* signInGuardian(fixture);
      expect(
        yield* client
          .mutation(ask, {
            kind: "reportCopy",
            linkId: link.id,
            slug: nf,
            text: "Salinan rapor.",
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "AccessDenied" });
    })
  );
});
