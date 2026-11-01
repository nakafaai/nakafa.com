import { FunctionImpl, GroupImpl } from "@confect/server";
import insightInternal from "@repo/backend/confect/_generated/refs/insight.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { movePool, schoolHoldOf } from "@repo/backend/confect/credits/pool";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { requireStudent } from "@repo/backend/confect/insight/access";
import {
  DRAFT_CREDITS,
  DRAFT_INSTRUCTIONS,
  DraftAnswer,
  type DraftSource,
  promptOf,
} from "@repo/backend/confect/insight/drafts";
import spec from "@repo/backend/confect/insight/drafts.spec";
import { DraftRefused } from "@repo/backend/confect/insight/errors";
import { draftField } from "@repo/backend/confect/insight/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { schemeForEntry } from "@repo/backend/confect/records/version";
import { sealText } from "@repo/backend/confect/vault/text";
import { generateText, Output } from "ai";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Option,
  Struct,
} from "effect";

/** The competencies one draft reads: more than one class's exams name. */
const SKILL_PAGE = 50;

/** Holds the credits of a draft and schedules it. A draft Nina is already writing is not asked for twice. */
const ask = FunctionImpl.make(
  databaseSchema,
  spec,
  "ask",
  Effect.fn("insight.drafts.ask")(function* ({ personId }) {
    const { person, tenant } = yield* Member;
    const row = yield* Class;
    yield* requireStudent(personId);
    const found = yield* (yield* DatabaseReader)
      .table("insightDrafts")
      .index("by_classId_and_personId", (query) =>
        query.eq("classId", row._id).eq("personId", personId)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(found) && found.value.sealedText === undefined) {
      return null;
    }
    const hold = tenant.policies.nina
      ? yield* schoolHoldOf(person, row.tenantId, DRAFT_CREDITS)
      : Option.none();
    if (Option.isNone(hold)) {
      return yield* new DraftRefused();
    }
    yield* movePool(hold.value.draw, hold.value.userId, DRAFT_CREDITS);
    const writer = yield* DatabaseWriter;
    const updatedAt = yield* Clock.currentTimeMillis;
    const draftId = yield* Option.match(found, {
      onNone: () =>
        writer.table("insightDrafts").insert({
          askedBy: person._id,
          classId: row._id,
          periodId: row.periodId,
          personId,
          tenantId: row.tenantId,
          updatedAt,
        }),
      onSome: (draft) =>
        writer
          .table("insightDrafts")
          .replace(
            draft._id,
            Struct.assign(
              Struct.omit(draft, ["_creationTime", "_id", "sealedText"]),
              { askedBy: person._id, updatedAt }
            )
          )
          .pipe(Effect.as(draft._id)),
    }).pipe(Effect.orDie);
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      insightInternal.drafts.write,
      { draftId }
    );
    return null;
  })
);

/** Reads the numbers one draft is written from, with no name, so the model never learns who the student is. */
const source = FunctionImpl.make(
  databaseSchema,
  spec,
  "source",
  Effect.fn("insight.drafts.source")(function* ({ draftId }) {
    const reader = yield* DatabaseReader;
    const draft = yield* reader
      .table("insightDrafts")
      .get(draftId)
      .pipe(Effect.orDie);
    const klass = yield* reader
      .table("classes")
      .get(draft.classId)
      .pipe(Effect.orDie);
    const unit = yield* reader
      .table("tenantUnits")
      .get(klass.unitId)
      .pipe(Effect.orDie);
    const { kktp } = yield* schemeForEntry(draft.tenantId);
    const skills = yield* reader
      .table("insightMastery")
      .index("by_personId_and_periodId_and_competency", (query) =>
        query.eq("personId", draft.personId).eq("periodId", draft.periodId)
      )
      .take(SKILL_PAGE)
      .pipe(Effect.orDie);
    return {
      kktp,
      locale: unit.contentLanguage,
      skills: Arr.map(
        skills,
        Struct.pick([
          "competency",
          "earned",
          "observations",
          "possible",
          "rating",
        ])
      ),
    };
  })
);

/** Seals a draft for its teacher, or gives the credits back and removes it when Nina has none. */
const finish = FunctionImpl.make(
  databaseSchema,
  spec,
  "finish",
  Effect.fn("insight.drafts.finish")(function* ({ draftId, text }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const draft = yield* reader
      .table("insightDrafts")
      .get(draftId)
      .pipe(Effect.orDie);
    if (text !== null) {
      yield* writer
        .table("insightDrafts")
        .patch(draftId, {
          sealedText: yield* sealText(
            yield* schoolKeys(draft.tenantId),
            draftField(draft),
            text
          ).pipe(Effect.orDie),
          updatedAt: yield* Clock.currentTimeMillis,
        })
        .pipe(Effect.orDie);
      return null;
    }
    const asker = yield* reader
      .table("tenantPeople")
      .get(draft.askedBy)
      .pipe(Effect.orDie);
    const hold = yield* schoolHoldOf(asker, draft.tenantId, 0);
    if (Option.isSome(hold)) {
      yield* movePool(hold.value.draw, hold.value.userId, -DRAFT_CREDITS);
    }
    yield* writer.table("insightDrafts").delete(draftId).pipe(Effect.orDie);
    return null;
  })
);

/** What the model drafts for one student, or nothing when it is not sure or the call fails. */
const answerOf = (from: typeof DraftSource.Type) =>
  Effect.gen(function* () {
    const model = (yield* Gateway).language("specialist");
    const { output } = yield* Effect.tryPromise((signal) =>
      generateText({
        abortSignal: signal,
        messages: [{ content: promptOf(from), role: "user" }],
        model: model.model,
        output: Output.object({ schema: createEffectSchema(DraftAnswer) }),
        system: DRAFT_INSTRUCTIONS,
        timeout: model.timeout,
      })
    );
    return output.unsure ? null : output.text;
  }).pipe(
    Effect.provide(GatewayLive),
    Effect.orElseSucceed(() => null)
  );

/** Runs one draft: the read, the model outside any transaction, and the settlement. */
const write = FunctionImpl.make(
  databaseSchema,
  spec,
  "write",
  Effect.fn("insight.drafts.write")(function* ({ draftId }) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const from = yield* runQuery(insightInternal.drafts.source, {
      draftId,
    }).pipe(Effect.orDie);
    const text = yield* answerOf(from);
    yield* runMutation(insightInternal.drafts.finish, { draftId, text }).pipe(
      Effect.orDie
    );
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(ask),
  Layer.provide(source),
  Layer.provide(finish),
  Layer.provide(write),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
