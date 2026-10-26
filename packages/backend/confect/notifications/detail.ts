import type {
  NotificationsDoc,
  TenantPeopleDoc,
  TenantsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { mayIn, principalOf } from "@repo/backend/confect/classroom/roster";
import type { ClassDetail } from "@repo/backend/confect/notifications/schema";
import { Effect, Match, Option } from "effect";

/**
 * The class of a row, its author's name, and whether the recipient still reads the
 * class, each read when the row is read (ADR 0027). A class the recipient no
 * longer reads gives no detail, so the row shows nothing of it.
 */
const classPart = Effect.fn("notifications.detail.class")(function* (
  classId: NotificationsDoc["subject"]["id"],
  authorId: TenantPeopleDoc["_id"],
  person: TenantPeopleDoc,
  tenant: TenantsDoc
) {
  const reader = yield* DatabaseReader;
  const klass = yield* reader.table("classes").get(classId).pipe(Effect.option);
  if (Option.isNone(klass) || klass.value.tenantId !== tenant._id) {
    return Option.none();
  }
  if (
    !(yield* mayIn(
      "forum.read",
      klass.value,
      yield* principalOf(person, tenant)
    ))
  ) {
    return Option.none();
  }
  const author = yield* reader
    .table("tenantPeople")
    .get(authorId)
    .pipe(Effect.option);
  return Option.some({
    actor: Option.match(author, {
      onNone: () => "",
      onSome: (found) => found.name,
    }),
    className: klass.value.name,
    classSlug: klass.value.slug,
  });
});

/**
 * The detail of one row for its recipient: the mention's message and where it is,
 * or the announcement's class home. An invitation has none, and neither has a row
 * whose source is gone or whose class the recipient no longer reads.
 */
export const detailOf = Effect.fn("notifications.detail")(function* (
  row: NotificationsDoc,
  person: TenantPeopleDoc,
  tenant: TenantsDoc
) {
  const reader = yield* DatabaseReader;
  const detail: Option.Option<typeof ClassDetail.Type> = yield* Match.value(
    row
  ).pipe(
    Match.discriminatorsExhaustive("changeType")({
      "announcement.posted": (announcement) =>
        Effect.gen(function* () {
          const post = yield* reader
            .table("classroomPosts")
            .get(announcement.postId)
            .pipe(Effect.option);
          if (Option.isNone(post)) {
            return Option.none();
          }
          const part = yield* classPart(
            post.value.classId,
            post.value.authorId,
            person,
            tenant
          );
          return Option.map(part, (found) => ({
            ...found,
            channelId: null,
            discussion: null,
            messageId: null,
          }));
        }),
      "forum.mentioned": (mention) =>
        Effect.gen(function* () {
          const message = yield* reader
            .table("classroomMessages")
            .get(mention.messageId)
            .pipe(Effect.option);
          if (Option.isNone(message)) {
            return Option.none();
          }
          const part = yield* classPart(
            message.value.classId,
            message.value.authorId,
            person,
            tenant
          );
          const thread =
            message.value.threadId === undefined
              ? Option.none()
              : yield* reader
                  .table("classroomThreads")
                  .get(message.value.threadId)
                  .pipe(Effect.option);
          return Option.map(part, (found) => ({
            ...found,
            channelId: message.value.channelId,
            discussion: Option.match(thread, {
              onNone: () => null,
              onSome: (discussion) => discussion.number,
            }),
            messageId: message.value._id,
          }));
        }),
      "person.invited": () => Effect.succeed(Option.none()),
    })
  );
  return Option.getOrNull(detail);
});
