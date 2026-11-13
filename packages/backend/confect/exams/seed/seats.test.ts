import authTest from "@convex-dev/auth/test";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { schoolTiers } from "@repo/backend/confect/billing/tiers";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { api } from "@repo/backend/convex/_generated/api";
import { nf } from "@repo/backend/test/editor";
import { keyedSchool } from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { load, seats } = refs.internal.exams.seed;
const { dashboard, enter, mine } = refs.public.exams.sittings;

/** A seat of the test with its own key and token. */
const seat = (number: number) => ({
  key: `load-test-${number}`,
  name: `Siswa ${number}`,
  token: `seat-token-${number}`,
});

describe("exams seed seats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    vi.stubEnv("ACCEPTANCE_SEED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "seats a student past the free plan's limit, since the run's school holds a contract",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        // The school is already full: one student more is refused on the free plan.
        yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const unit = yield* reader
              .table("tenantUnits")
              .index("by_tenantId_and_status", (query) =>
                query.eq("tenantId", fixture.tenants.nf).eq("status", "active")
              )
              .first()
              .pipe(
                Effect.orDie,
                Effect.flatMap(Effect.fromOption),
                Effect.orDie
              );
            yield* Effect.forEach(
              Arr.makeBy(schoolTiers.free.accounts, (index) => index),
              (index) =>
                writer
                  .table("tenantPeople")
                  .insert({
                    account: { state: "unclaimed" },
                    kind: "member",
                    name: `Penuh ${index}`,
                    status: "active",
                    tenantId: fixture.tenants.nf,
                  })
                  .pipe(
                    Effect.flatMap((personId) =>
                      writer.table("tenantGrants").insert({
                        grantedBy: systemActor,
                        personId,
                        role: { key: "student", kind: "builtin" },
                        scope: { kind: "unit", unitId: unit._id },
                        status: "active",
                        tenantId: fixture.tenants.nf,
                        term: { kind: "standing" },
                      })
                    ),
                    Effect.orDie
                  ),
              { discard: true }
            );
          })
        );
        const refused = yield* fixture.internal
          .mutation(seats, { kind: "student", seats: [seat(1)], slug: nf })
          .pipe(Effect.exit);
        expect(refused._tag).toBe("Failure");

        yield* fixture.internal.mutation(load, {
          questions: 1,
          rooms: 1,
          slug: nf,
        });
        yield* fixture.internal.mutation(seats, {
          kind: "student",
          seats: [seat(2)],
          slug: nf,
        });
      })
  );

  it.effect("refuses the seed outside the acceptance runtime", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      vi.stubEnv("ACCEPTANCE_SEED", "false");
      const refusal = yield* fixture.internal
        .mutation(seats, { kind: "student", seats: [seat(1)], slug: nf })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "SeedRefused" });
    })
  );

  it.effect(
    "seats signed-in students who enter a room with its token, and a proctor who reads its dashboard",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const made = yield* fixture.internal.mutation(load, {
          questions: 1,
          rooms: 1,
          slug: nf,
        });
        const room = yield* Effect.fromOption(Arr.head(made.sittings)).pipe(
          Effect.orDie
        );
        const students = yield* fixture.internal.mutation(seats, {
          kind: "student",
          seats: [seat(1), seat(2)],
          slug: nf,
        });
        const proctors = yield* fixture.internal.mutation(seats, {
          kind: "proctor",
          seats: [seat(3)],
          slug: nf,
        });
        // A seat signs in as the load test does: its account id, and its token as the password.
        const signedIn = (userId: string | undefined, token: string) =>
          Effect.promise(() =>
            fixture.convex.mutation(api.auth.core.signInWithUsernamePassword, {
              password: token,
              username: userId ?? "",
            })
          ).pipe(
            Effect.map((answer) => {
              assert(answer.status === "complete", "Expected a session.");
              return fixture.signedIn(
                authTest.sessionIdentity(answer.tokens).subject
              );
            })
          );
        const student = yield* signedIn(students[1], "seat-token-2");
        const listed = yield* student.query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.id)).toEqual([room.id]);
        const entered = yield* student.mutation(enter, {
          deviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
          sittingId: room.id,
          slug: nf,
          token: room.token,
        });
        expect(entered).toMatchObject({ outcome: "admitted" });
        const proctor = yield* signedIn(proctors[0], "seat-token-3");
        const page = yield* proctor.query(dashboard, {
          paginationOpts: { cursor: null, numItems: 100 },
          sittingId: room.id,
          slug: nf,
        });
        expect(page.can).toContain("sitting.proctor");
        expect(
          Arr.map(page.attempts.page, (attempt) => [
            attempt.name,
            attempt.state,
          ])
        ).toEqual([["Siswa 2", "inProgress"]]);
      })
  );
});
