import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { activeOwners, assignRole } from "@repo/backend/confect/access/grant";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { createDocument } from "@repo/backend/confect/editor/create";
import { storedDocument } from "@repo/backend/confect/editor/document";
import {
  encodeAnswers,
  encodeKey,
  newChoiceAnswers,
} from "@repo/backend/confect/exams/question";
import { placeQuestion } from "@repo/backend/confect/exams/questions/place";
import { openSitting } from "@repo/backend/confect/exams/sittings/closing";
import { createSitting } from "@repo/backend/confect/exams/sittings/schedule";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { Array as Arr, Clock, Effect, Option, Schema } from "effect";

/** The title of the seeded exam. */
const EXAM_TITLE = "Ujian Acceptance";

/** The room of the seeded sitting. */
const ROOM = "Lab 2";

/** One hour, the length of the seeded sitting after it opens. */
const SITTING_LENGTH_MS = 60 * 60 * 1000;

/** The key of a seeded question: its first option is the correct answer. */
const FIRST_OPTION_KEY: Arr.NonEmptyReadonlyArray<InteractionKey> = [
  { correct: ["option-1"], interaction: "choice", kind: "choice" },
];

/** A prompt of one paragraph with the text, in the stored form that the editor writes. */
const promptText = (text: string) =>
  `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"${text}"}]}]}`;

/** The value of a lookup that must find one row. A missing row ends the seed with a defect that names it. */
const required = <A>(lookup: Option.Option<A>, missing: string) =>
  Option.match(lookup, {
    onNone: () => Effect.die(missing),
    onSome: Effect.succeed,
  });

/**
 * Seats a crowd of extra students in a sitting, each an unclaimed Person named by their
 * number with an attempt in progress, so a browser test reads a dashboard of more than one
 * page.
 */
const seatCrowd = Effect.fn("exams.seed.crowd")(function* (crowd: {
  readonly count: number;
  readonly deadline: number;
  readonly now: number;
  readonly sittingId: ExamSittingsDoc["_id"];
  readonly tenantId: ExamsDoc["tenantId"];
}) {
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    Arr.makeBy(crowd.count, (index) => index + 1),
    (seat) =>
      writer
        .table("tenantPeople")
        .insert({
          account: { state: "unclaimed" },
          kind: "member",
          name: `Seat ${String(seat).padStart(3, "0")}`,
          status: "active",
          tenantId: crowd.tenantId,
        })
        .pipe(
          Effect.flatMap((person) =>
            writer.table("examAttempts").insert({
              deadline: crowd.deadline,
              deviceId: null,
              person,
              retiredDeviceIds: [],
              sitting: crowd.sittingId,
              startedAt: crowd.now,
              state: "inProgress",
              tenantId: crowd.tenantId,
            })
          ),
          Effect.orDie
        ),
    { discard: true }
  );
});

/** The school with the slug. */
const tenantOf = Effect.fn("exams.seed.tenant")(function* (slug: string) {
  const found = yield* (yield* DatabaseReader)
    .table("tenants")
    .index("by_slug", (query) => query.eq("slug", slug))
    .first()
    .pipe(Effect.orDie);
  return yield* required(found, "No school has this slug.");
});

/** The first active unit of the school, which the seeded grant and sitting use. */
const firstActiveUnit = Effect.fn("exams.seed.unit")(function* (
  tenantId: ExamsDoc["tenantId"]
) {
  const found = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .index("by_tenantId_and_status", (query) =>
      query.eq("tenantId", tenantId).eq("status", "active")
    )
    .first()
    .pipe(Effect.orDie);
  return yield* required(found, "The school has no active unit.");
});

/**
 * The user of the Owner who signed in first, as the author of the seeded exam. An Owner who
 * has not signed in holds no user to author it.
 */
const ownerUserId = Effect.fn("exams.seed.owner")(function* (
  tenantId: ExamsDoc["tenantId"]
) {
  const grant = yield* required(
    Arr.head(yield* activeOwners(tenantId)),
    "The school has no Owner."
  );
  const owner = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(grant.personId)
    .pipe(Effect.orDie);
  if (owner.account.state !== "claimed") {
    return yield* Effect.die("The school's Owner has not signed in.");
  }
  return owner.account.userId;
});

/**
 * Places one seeded question after `after`: a prompt of one paragraph, and one choice whose
 * first option is the correct answer. It returns the question's ID.
 */
const seedQuestion = Effect.fn("exams.seed.question")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">,
  after: ExamQuestionsDoc["_id"] | null,
  text: string
) {
  const prompt = yield* createDocument({
    scope: exam.scope,
    tenantId: exam.tenantId,
    text: yield* storedDocument(promptText(text)).pipe(Effect.orDie),
  }).pipe(Effect.orDie);
  const answers = yield* encodeAnswers(newChoiceAnswers());
  const key = yield* encodeKey(FIRST_OPTION_KEY);
  return yield* placeQuestion(exam, after, { answers, key, prompt }).pipe(
    Effect.orDie
  );
});

/**
 * Gives the learner who holds the address a student grant in the school's first active unit,
 * then creates a keyed exam with two choice questions and a sitting of it that opens now and
 * closes an hour later. The learner must already be a member of the school, because a claim
 * happens when the account signs in. The journal records the schedule as the system (ADR 0013).
 */
export const seedSitting = Effect.fn("exams.seed.sitting")(function* (args: {
  readonly crowd?: number;
  readonly email: string;
  readonly slug: string;
}) {
  yield* requireAcceptanceSeed();
  const reader = yield* DatabaseReader;
  const tenant = yield* tenantOf(args.slug);
  const unit = yield* firstActiveUnit(tenant._id);
  const user = yield* required(
    yield* reader
      .table("users")
      .index("by_email", (query) => query.eq("email", args.email))
      .first()
      .pipe(Effect.orDie),
    "No account holds this address."
  );
  const learner = yield* required(
    yield* reader
      .table("tenantPeople")
      .index("by_tenantId_and_account_userId", (query) =>
        query.eq("tenantId", tenant._id).eq("account.userId", user._id)
      )
      .first()
      .pipe(Effect.orDie),
    "This address is not a member of the school."
  );
  yield* assignRole(systemActor, learner, "student", {
    kind: "unit",
    unitId: unit._id,
  }).pipe(Effect.orDie);
  const now = yield* Clock.currentTimeMillis;
  const scope: GrantScope = { kind: "unit", unitId: unit._id };
  const language = yield* Schema.decodeEffect(DeliveryLanguageSchema)(
    unit.contentLanguage
  ).pipe(Effect.orDie);
  const examId = yield* (yield* DatabaseWriter)
    .table("exams")
    .insert({
      createdAt: now,
      createdBy: yield* ownerUserId(tenant._id),
      language,
      questions: [],
      scope,
      tenantId: tenant._id,
      title: EXAM_TITLE,
    })
    .pipe(Effect.orDie);
  const first = yield* seedQuestion(
    { _id: examId, questions: [], scope, tenantId: tenant._id },
    null,
    "Soal pertama."
  );
  yield* seedQuestion(
    { _id: examId, questions: [first], scope, tenantId: tenant._id },
    first,
    "Soal kedua."
  );
  const exam = yield* reader.table("exams").get(examId).pipe(Effect.orDie);
  const made = yield* createSitting({
    actor: systemActor,
    closesAt: now + SITTING_LENGTH_MS,
    exam,
    opensAt: now,
    place: { cohortId: null, unitId: unit._id },
    room: ROOM,
    tenantId: tenant._id,
  }).pipe(Effect.orDie);
  yield* openSitting(made.id);
  yield* seatCrowd({
    count: args.crowd ?? 0,
    deadline: now + SITTING_LENGTH_MS,
    now,
    sittingId: made.id,
    tenantId: tenant._id,
  });
  return { examId, sittingId: made.id, token: made.token };
});
