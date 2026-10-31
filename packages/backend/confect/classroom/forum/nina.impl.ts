import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  ClassesDoc,
  ClassroomMessagesDoc,
} from "@repo/backend/confect/_generated/docs";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { messageField } from "@repo/backend/confect/classroom/forum/message";
import {
  FORUM_INSTRUCTIONS,
  HISTORY_LIMIT,
  NINA_NAME,
  NinaAnswer,
  type NinaAsk,
  promptOf,
  REPLY_CREDITS,
} from "@repo/backend/confect/classroom/forum/nina";
import spec from "@repo/backend/confect/classroom/forum/nina.spec";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { principalOf } from "@repo/backend/confect/classroom/roster";
import { movePool, schoolHoldOf } from "@repo/backend/confect/credits/pool";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { findContent } from "@repo/backend/confect/nina/nakafa/find";
import { queueMail } from "@repo/backend/confect/notifications/mail";
import { schedulePush } from "@repo/backend/confect/notifications/schedule";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { generateText, Output } from "ai";
import {
  Array as Arr,
  Clock,
  Effect,
  Layer,
  Option,
  String as Str,
  Struct,
} from "effect";

/** The teachers one question reaches: a class has few. */
const TEACHER_LIMIT = 20;

/** The most characters a reply takes, which a message holds. */
const REPLY_LENGTH = 4000;

/** Writes one inbox row of a forum message, with its push and its place in the digest. */
const noticeOf = Effect.fn("classroom.forum.nina.notice")(function* (
  message: Pick<ClassroomMessagesDoc, "_id">,
  personId: ClassroomMessagesDoc["authorId"],
  klass: ClassesDoc
) {
  const reader = yield* DatabaseReader;
  const person = yield* reader
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  const tenant = yield* reader
    .table("tenants")
    .get(klass.tenantId)
    .pipe(Effect.orDie);
  const principal = yield* principalOf(person, tenant);
  const notificationId = yield* (yield* DatabaseWriter)
    .table("notifications")
    .insert({
      changeType: "forum.mentioned",
      createdAt: yield* Clock.currentTimeMillis,
      messageId: message._id,
      recipientPersonId: personId,
      subject: { id: klass._id, kind: "class" },
      tenantId: klass.tenantId,
    })
    .pipe(Effect.orDie);
  yield* schedulePush(notificationId, person, principal.grants, klass.unitId);
  yield* queueMail(
    "forumMention",
    "teacher",
    person,
    klass.unitId,
    Option.none()
  );
});

/** Passes a question Nina does not answer to the class's teachers, as a mention of each (ADR 0025). */
const passOn = Effect.fn("classroom.forum.nina.pass")(function* (
  question: ClassroomMessagesDoc,
  klass: ClassesDoc
) {
  const teachers = yield* (yield* DatabaseReader)
    .table("classTeachers")
    .index("by_classId_and_personId", (query) => query.eq("classId", klass._id))
    .take(TEACHER_LIMIT)
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    teachers,
    (teacher) => noticeOf(question, teacher.personId, klass),
    { discard: true }
  );
});

/** The account that asked and what it may draw from the school's pool now, if anything. */
const holdOf = Effect.fn("classroom.forum.nina.hold")(function* (
  question: ClassroomMessagesDoc,
  klass: ClassesDoc
) {
  const asker = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(question.authorId)
    .pipe(Effect.orDie);
  return yield* schoolHoldOf(asker, klass.tenantId, REPLY_CREDITS);
});

/** The messages before a question in its channel or discussion, oldest first, without what a teacher hid. */
const historyOf = Effect.fn("classroom.forum.nina.history")(function* (
  question: ClassroomMessagesDoc
) {
  const reader = yield* DatabaseReader;
  const keys = yield* schoolKeys(question.tenantId);
  const rows = yield* reader
    .table("classroomMessages")
    .index(
      "by_channelId_and_threadId",
      (query) =>
        query
          .eq("channelId", question.channelId)
          .eq("threadId", question.threadId),
      "desc"
    )
    .take(HISTORY_LIMIT + 1)
    .pipe(Effect.orDie);
  const shown = Arr.getSomes(
    Arr.map(rows, (row) =>
      row._id === question._id || row.sealedText === null
        ? Option.none()
        : Option.some({ row, sealed: row.sealedText })
    )
  );
  return yield* Effect.forEach(Arr.reverse(shown), ({ row, sealed }) =>
    Effect.gen(function* () {
      const author = yield* reader
        .table("tenantPeople")
        .get(row.authorId)
        .pipe(Effect.orDie);
      return {
        author: row.nina === true ? NINA_NAME : author.name,
        text: yield* openMessage(keys, row, sealed),
      };
    })
  );
});

/** Opens the text of one message. Only a hidden message holds none, and neither read reaches one. */
const openMessage = (
  keys: Effect.Success<ReturnType<typeof schoolKeys>>,
  row: ClassroomMessagesDoc,
  sealed: ArrayBuffer
) => openText(keys, messageField(row), sealed).pipe(Effect.orDie);

/**
 * Holds the credits of a reply and reads what Nina needs. A question a teacher hid, or a school that turned Nina off,
 * gets nothing. A question with no credits behind it goes to the teachers at once.
 */
const begin = FunctionImpl.make(
  databaseSchema,
  spec,
  "begin",
  Effect.fn("classroom.forum.nina.begin")(function* ({ messageId }) {
    const reader = yield* DatabaseReader;
    const question = yield* reader
      .table("classroomMessages")
      .get(messageId)
      .pipe(Effect.orDie);
    const klass = yield* reader
      .table("classes")
      .get(question.classId)
      .pipe(Effect.orDie);
    const tenant = yield* reader
      .table("tenants")
      .get(question.tenantId)
      .pipe(Effect.orDie);
    if (question.sealedText === null || !tenant.policies.nina) {
      return null;
    }
    const hold = yield* holdOf(question, klass);
    if (Option.isNone(hold)) {
      yield* passOn(question, klass);
      return null;
    }
    yield* movePool(hold.value.draw, hold.value.userId, REPLY_CREDITS);
    const unit = yield* reader
      .table("tenantUnits")
      .get(klass.unitId)
      .pipe(Effect.orDie);
    const keys = yield* schoolKeys(question.tenantId);
    return {
      className: klass.name,
      history: yield* historyOf(question),
      locale: unit.contentLanguage,
      question: yield* openMessage(keys, question, question.sealedText),
    } satisfies typeof NinaAsk.Type;
  })
);

/**
 * Settles a reply: Nina's message under the question, in its channel or discussion, which tells the student who asked;
 * or, with no answer, the question goes to the teachers and the credits come back. A failure invents no reply.
 */
const finish = FunctionImpl.make(
  databaseSchema,
  spec,
  "finish",
  Effect.fn("classroom.forum.nina.finish")(function* ({ answer, messageId }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const question = yield* reader
      .table("classroomMessages")
      .get(messageId)
      .pipe(Effect.orDie);
    const klass = yield* reader
      .table("classes")
      .get(question.classId)
      .pipe(Effect.orDie);
    if (answer === null) {
      const hold = yield* holdOf(question, klass);
      if (Option.isSome(hold)) {
        yield* movePool(hold.value.draw, hold.value.userId, -REPLY_CREDITS);
      }
      yield* passOn(question, klass);
      return null;
    }
    const fields = {
      channelId: question.channelId,
      classId: question.classId,
      clientKey: `nina-${question._id}`,
    };
    const replyId = yield* writer
      .table("classroomMessages")
      .insert({
        ...fields,
        authorId: question.authorId,
        createdAt: yield* Clock.currentTimeMillis,
        nina: true,
        sealedText: yield* sealText(
          yield* schoolKeys(question.tenantId),
          messageField(fields),
          Str.slice(0, REPLY_LENGTH)(answer)
        ).pipe(Effect.orDie),
        tenantId: question.tenantId,
        ...(question.threadId === undefined
          ? {}
          : { threadId: question.threadId }),
      })
      .pipe(Effect.orDie);
    if (question.threadId !== undefined) {
      const thread = yield* reader
        .table("classroomThreads")
        .get(question.threadId)
        .pipe(Effect.orDie);
      yield* writer
        .table("classroomThreads")
        .replace(
          thread._id,
          Struct.assign(Struct.omit(thread, ["_creationTime", "_id"]), {
            lastReplyAt: yield* Clock.currentTimeMillis,
            replies: thread.replies + 1,
          })
        )
        .pipe(Effect.orDie);
    }
    yield* noticeOf({ _id: replyId }, question.authorId, klass);
    return null;
  })
);

/** What the model answers for one question, or nothing when it is not sure or the call fails. */
const answerOf = (ask: typeof NinaAsk.Type, sources: string) =>
  Effect.gen(function* () {
    const writer = (yield* Gateway).language("specialist");
    const { output } = yield* Effect.tryPromise((signal) =>
      generateText({
        abortSignal: signal,
        messages: [{ content: promptOf(ask, sources), role: "user" }],
        model: writer.model,
        output: Output.object({ schema: createEffectSchema(NinaAnswer) }),
        system: FORUM_INSTRUCTIONS,
        timeout: writer.timeout,
      })
    );
    return output.unsure ? null : output.text;
  }).pipe(
    Effect.provide(GatewayLive),
    Effect.orElseSucceed(() => null)
  );

/** Runs one reply: the hold and the read, the model outside any transaction, and the settlement. */
const reply = FunctionImpl.make(
  databaseSchema,
  spec,
  "reply",
  Effect.fn("classroom.forum.nina.reply")(function* ({ messageId }) {
    const { runMutation } = yield* MutationRunner;
    const ask = yield* runMutation(classroomInternal.forum.nina.begin, {
      messageId,
    }).pipe(Effect.orDie);
    if (ask === null) {
      return null;
    }
    const sources = yield* findContent({
      limit: 3,
      locale: ask.locale,
      offset: 0,
      queries: [ask.question],
    }).pipe(
      Effect.map((found) => found.text),
      Effect.orElseSucceed(() => "")
    );
    const answer = yield* answerOf(ask, sources);
    yield* runMutation(classroomInternal.forum.nina.finish, {
      answer,
      messageId,
    }).pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(begin),
  Layer.provide(finish),
  Layer.provide(reply),
  GroupImpl.finalize
);
