import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { SCHOOL_FREE_STUDENTS } from "@repo/backend/confect/billing/catalog";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { nf } from "@repo/backend/test/editor";
import { keyedSchool } from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const { load, seats } = refs.internal.exams.seed;
const { dashboard, enter, mine } = refs.public.exams.sittings;

/** The session that Better Auth holds for a token, as the session middleware reads it. */
const Session = Schema.Struct({ _id: Schema.String, userId: Schema.String });

/** A seat of the test with its own key and token. */
const seat = (number: number) => ({
  key: `load-test-${number}`,
  name: `Siswa ${number}`,
  token: `token-${number}`,
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
              Arr.makeBy(SCHOOL_FREE_STUDENTS, (index) => index),
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
        yield* fixture.internal.mutation(seats, {
          kind: "student",
          seats: [seat(1), seat(2)],
          slug: nf,
        });
        yield* fixture.internal.mutation(seats, {
          kind: "proctor",
          seats: [seat(3)],
          slug: nf,
        });
        const signedIn = (token: string) =>
          Effect.promise(() =>
            fixture.convex.run((ctx) =>
              ctx.runQuery(components.betterAuth.adapter.findOne, {
                model: "session",
                where: [{ field: "token", operator: "eq", value: token }],
              })
            )
          ).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(Session)),
            Effect.map((session) =>
              fixture.signedIn({
                sessionId: session._id,
                subject: session.userId,
              })
            )
          );
        const student = yield* signedIn("token-2");
        const listed = yield* student.query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.id)).toEqual([room.id]);
        const entered = yield* student.mutation(enter, {
          deviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
          sittingId: room.id,
          slug: nf,
          token: room.token,
        });
        expect(entered).toMatchObject({ outcome: "admitted" });
        const proctor = yield* signedIn("token-3");
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
