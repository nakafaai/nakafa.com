import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { keyedFixture, nf } from "@repo/backend/test/classroom";
import { provider } from "@repo/backend/test/gateway";
import { openClass, sat, scored } from "@repo/backend/test/insight";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

type Fixture = Effect.Success<typeof tenancyFixture>;

const { ask } = refs.public.insight.drafts;
const { ofClass } = refs.public.insight.reads;
const narratives = refs.public.insight.narratives;
const observe = refs.internal.insight.observe.run;

/** Nina answers every draft with `output`. */
const ninaWrites = (output: { text: string; unsure: boolean }) => {
  const model = new MockLanguageModelV4({
    doGenerate: providerStep([{ text: encodeJsonText(output), type: "text" }]),
  });
  provider.languageModel.mockReturnValue(model);
  return model;
};

/** Turns Nina on for the school, and gives it a pool when `ninaSeats` names one. */
const withPool = (fixture: Fixture, ninaSeats: number) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const tenant = yield* (yield* DatabaseReader)
        .table("tenants")
        .get(fixture.tenants.nf);
      yield* writer.table("tenants").patch(fixture.tenants.nf, {
        policies: { ...tenant.policies, nina: true },
      });
      if (ninaSeats > 0) {
        yield* writer.table("billingGrants").insert({
          ninaSeats,
          product: "school",
          scope: { kind: "tenant" },
          seats: ninaSeats,
          source: { contractId: "contract-nina", kind: "contract" },
          tenantId: fixture.tenants.nf,
          validFrom: 0,
          validTo: TENANCY_NOW * 2,
        });
      }
    }).pipe(Effect.orDie)
  );

/** What the school's pool has used this month. */
const poolUsed = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("creditPools").index("by_creation_time").take(5)
    ).pipe(
      Effect.map((rows) => Arr.map(rows, (row) => row.used)),
      Effect.orDie
    )
  );

/** A student of a class with one released answer, ready for a draft. */
const student = Effect.fn("test.insight.draft.student")(function* (
  fixture: Fixture
) {
  const forum = yield* openClass(fixture);
  const made = yield* sat(fixture, forum.classId);
  yield* scored(fixture, made, Arr.getUnsafe(made.questions, 0), 1);
  yield* fixture.internal.mutation(observe, {
    after: null,
    sittingId: made.sittingId,
  });
  return {
    classId: forum.classId,
    personId: fixture.people.student.personId,
    slug: nf,
  };
});

/** The draft the class's teacher sees for its first student. */
const draftSeen = (
  fixture: Fixture,
  names: Effect.Success<ReturnType<typeof student>>
) =>
  fixture
    .as("teacher")
    .query(ofClass, { classId: names.classId, slug: nf })
    .pipe(Effect.map((seen) => seen.students[0]?.draft));

describe("insight/drafts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  afterEach(() => {
    provider.languageModel.mockReset();
  });

  it.effect(
    "writes a draft from the numbers alone, draws its credits, and leaves once the teacher saves",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* withPool(fixture, 3);
        const names = yield* student(fixture);
        const model = ninaWrites({
          text: "Anak Anda kuat di Fisika.",
          unsure: false,
        });
        const teacher = fixture.as("teacher");

        yield* teacher.mutation(ask, names);
        expect(yield* draftSeen(fixture, names)).toEqual({ text: null });
        yield* teacher.mutation(ask, names);
        yield* fixture.finishScheduled();

        expect(yield* draftSeen(fixture, names)).toEqual({
          text: "Anak Anda kuat di Fisika.",
        });
        expect(yield* poolUsed(fixture)).toEqual([5]);
        expect(model.doGenerateCalls).toHaveLength(1);
        expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).not.toContain(
          "Budi"
        );

        yield* teacher.mutation(ask, names);
        yield* fixture.finishScheduled();
        expect(yield* poolUsed(fixture)).toEqual([10]);

        yield* teacher.mutation(narratives.write, {
          ...names,
          text: "Rajin dan teliti.",
        });
        expect(yield* draftSeen(fixture, names)).toBeNull();
      })
  );

  it.effect("keeps a draft Nina is still writing when the teacher saves", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const names = yield* student(fixture);
      const teacher = fixture.as("teacher");
      yield* teacher.mutation(ask, names);
      yield* teacher.mutation(narratives.write, { ...names, text: "Rajin." });
      expect(yield* draftSeen(fixture, names)).toEqual({ text: null });
    })
  );

  it.effect("gives the credits back when Nina has nothing to say", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const names = yield* student(fixture);
      ninaWrites({ text: "", unsure: true });

      yield* fixture.as("teacher").mutation(ask, names);
      yield* fixture.finishScheduled();

      expect(yield* draftSeen(fixture, names)).toBeNull();
      expect(yield* poolUsed(fixture)).toEqual([0]);
    })
  );

  it.effect("gives the credits back when the model call fails", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const names = yield* student(fixture);
      provider.languageModel.mockReturnValue(
        new MockLanguageModelV4({
          doGenerate: () => Promise.reject(new Error("The model is down.")),
        })
      );

      yield* fixture.as("teacher").mutation(ask, names);
      yield* fixture.finishScheduled();

      expect(yield* draftSeen(fixture, names)).toBeNull();
      expect(yield* poolUsed(fixture)).toEqual([0]);
    })
  );

  it.effect("removes a failed draft when the school's pool has ended", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const names = yield* student(fixture);
      ninaWrites({ text: "", unsure: true });

      yield* fixture.as("teacher").mutation(ask, names);
      yield* fixture.run(
        Effect.gen(function* () {
          const grants = yield* (yield* DatabaseReader)
            .table("billingGrants")
            .index("by_creation_time")
            .take(5);
          const writer = yield* DatabaseWriter;
          yield* Effect.forEach(
            grants,
            (grant) => writer.table("billingGrants").delete(grant._id),
            { discard: true }
          );
        }).pipe(Effect.orDie)
      );
      yield* fixture.finishScheduled();

      expect(yield* draftSeen(fixture, names)).toBeNull();
      expect(yield* poolUsed(fixture)).toEqual([5]);
    })
  );

  it.effect("refuses a draft the school does not allow or cannot pay for", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const names = yield* student(fixture);
      const teacher = fixture.as("teacher");
      expect(
        yield* teacher.mutation(ask, names).pipe(Effect.flip)
      ).toMatchObject({ _tag: "DraftRefused" });
      yield* withPool(fixture, 0);
      expect(
        yield* teacher.mutation(ask, names).pipe(Effect.flip)
      ).toMatchObject({ _tag: "DraftRefused" });
    })
  );

  it.effect("refuses a Person who is not the class's student", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* withPool(fixture, 3);
      const names = yield* student(fixture);
      expect(
        yield* fixture
          .as("teacher")
          .mutation(ask, {
            ...names,
            personId: fixture.people.teacher.personId,
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "AccessDenied" });
    })
  );
});
