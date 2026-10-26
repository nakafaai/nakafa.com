import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  firstActiveUnit,
  required,
  tenantOf,
} from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { activeOwners, assignRole } from "@repo/backend/confect/access/grant";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { createDocument } from "@repo/backend/confect/editor/create";
import { storedDocument } from "@repo/backend/confect/editor/document";
import {
  encodeAnswers,
  encodeKey,
  essayAnswers,
  NEW_QUESTION_POINTS,
  NEW_QUESTION_TEMPLATE,
  newChoiceAnswers,
} from "@repo/backend/confect/exams/question";
import {
  createEmptyDocument,
  placeQuestion,
} from "@repo/backend/confect/exams/questions/place";
import { openSitting } from "@repo/backend/confect/exams/sittings/closing";
import { createSitting } from "@repo/backend/confect/exams/sittings/schedule";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Clock, Effect } from "effect";

/** The title of the seeded exam. */
const EXAM_TITLE = "Ujian Acceptance";

/** The room of the seeded sitting. */
const ROOM = "Lab 2";

/** One hour, the length of the seeded sitting after it opens. */
const SITTING_LENGTH_MS = 60 * 60 * 1000;

/** The room of the seeded upcoming sitting, which opens the next day. */
const UPCOMING_ROOM = "Lab 3";

/** One day, how far ahead the seeded upcoming sitting opens. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The key of a seeded question: its first option is the correct answer. */
const FIRST_OPTION_KEY: Arr.NonEmptyReadonlyArray<InteractionKey> = [
  { correct: ["option-1"], interaction: "choice", kind: "choice" },
];

/**
 * The paragraphs of the second question's prompt. They mix Indonesian, Arabic and English, so a
 * browser test reads each paragraph in its own direction (e2e/school/multilingual.browser.ts).
 */
const MIXED_PARAGRAPHS: Arr.NonEmptyReadonlyArray<string> = [
  "Soal kedua: baca teks berikut dengan cermat.",
  "مرحبا بكم في الامتحان، اقرأ النص بعناية.",
  "Read the passage and answer the question below.",
];

/** One paragraph of a prompt, in the stored form that the editor writes. */
const paragraphNode = (text: string) => ({
  content: [{ text, type: "text" }],
  type: "paragraph",
});

/** A prompt of paragraphs with their text, in the stored form that the editor writes. */
const promptText = (paragraphs: Arr.NonEmptyReadonlyArray<string>) =>
  encodeJsonText({
    content: Arr.map(paragraphs, paragraphNode),
    type: "doc",
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
 * Places one seeded question after `after`: a prompt of one paragraph, empty rubric and explanation
 * documents, and one choice whose first option is the correct answer. It returns the question's ID.
 */
const seedQuestion = Effect.fn("exams.seed.question")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">,
  after: ExamQuestionsDoc["_id"] | null,
  paragraphs: Arr.NonEmptyReadonlyArray<string>
) {
  const prompt = yield* createDocument({
    scope: exam.scope,
    tenantId: exam.tenantId,
    text: yield* storedDocument(promptText(paragraphs)).pipe(Effect.orDie),
  }).pipe(Effect.orDie);
  const rubric = yield* createEmptyDocument(exam).pipe(Effect.orDie);
  const explanation = yield* createEmptyDocument(exam).pipe(Effect.orDie);
  const answers = yield* encodeAnswers(newChoiceAnswers());
  const key = yield* encodeKey(FIRST_OPTION_KEY);
  return yield* placeQuestion(exam, after, {
    answers,
    explanation,
    key,
    points: NEW_QUESTION_POINTS,
    prompt,
    rubric,
    template: NEW_QUESTION_TEMPLATE,
  }).pipe(Effect.orDie);
});

/** The points of the seeded essay, more than one so that a grade between none and all is partial. */
const ESSAY_POINTS = 4;

/**
 * Places the seeded essay after `after`: a prompt of one paragraph, empty rubric and explanation
 * documents, and one long text with no key, which the teacher grades by the rubric.
 */
const seedEssay = Effect.fn("exams.seed.essay")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">,
  after: ExamQuestionsDoc["_id"]
) {
  const prompt = yield* createDocument({
    scope: exam.scope,
    tenantId: exam.tenantId,
    text: yield* storedDocument(
      promptText(["Jelaskan proses fotosintesis dengan singkat."])
    ).pipe(Effect.orDie),
  }).pipe(Effect.orDie);
  const rubric = yield* createEmptyDocument(exam).pipe(Effect.orDie);
  const explanation = yield* createEmptyDocument(exam).pipe(Effect.orDie);
  return yield* placeQuestion(exam, after, {
    answers: yield* encodeAnswers(essayAnswers()),
    explanation,
    key: null,
    points: ESSAY_POINTS,
    prompt,
    rubric,
    template: "essay",
  }).pipe(Effect.orDie);
});

/**
 * Gives the learner who holds the address a student grant in the school's first active unit,
 * then creates a keyed exam with two choice questions, and an essay when `essay` asks for one, and a
 * sitting of it that opens now and closes an hour later. The learner must already be a member of the school, because a claim
 * happens when the account signs in. The journal records the schedule as the system (ADR 0013).
 */
export const seedSitting = Effect.fn("exams.seed.sitting")(function* (args: {
  readonly crowd?: number;
  readonly email: string;
  readonly essay?: boolean;
  readonly slug: string;
  readonly upcoming?: boolean;
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
  const examId = yield* (yield* DatabaseWriter)
    .table("exams")
    .insert({
      createdAt: now,
      createdBy: yield* ownerUserId(tenant._id),
      questions: [],
      scope,
      tenantId: tenant._id,
      title: EXAM_TITLE,
    })
    .pipe(Effect.orDie);
  const first = yield* seedQuestion(
    { _id: examId, questions: [], scope, tenantId: tenant._id },
    null,
    ["Soal pertama."]
  );
  const second = yield* seedQuestion(
    { _id: examId, questions: [first], scope, tenantId: tenant._id },
    first,
    MIXED_PARAGRAPHS
  );
  if (args.essay === true) {
    yield* seedEssay(
      { _id: examId, questions: [first, second], scope, tenantId: tenant._id },
      second
    );
  }
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
  if (args.upcoming === true) {
    yield* createSitting({
      actor: systemActor,
      closesAt: now + DAY_MS + SITTING_LENGTH_MS,
      exam,
      opensAt: now + DAY_MS,
      place: { cohortId: null, unitId: unit._id },
      room: UPCOMING_ROOM,
      tenantId: tenant._id,
    }).pipe(Effect.orDie);
  }
  return {
    examId,
    sittingId: made.id,
    title: EXAM_TITLE,
    token: made.token,
  };
});
