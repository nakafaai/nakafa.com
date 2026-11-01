import type { ClassroomPostsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import type { PollDraft } from "@repo/backend/confect/classroom/forum/poll";
import { tallyValidator } from "@repo/backend/confect/classroom/forum/tally";
import type { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Schema } from "effect";

/** The most posts one read of votes names, a page of the class home. */
export const VOTES_READ_LIMIT = 30;

/**
 * Who voted in the poll of one announcement. Votes live apart from the post, one row a post and only once it holds
 * one, so a page of the class home stays still while a class votes.
 */
export const postVotesValidator = Schema.Struct({
  classId: Id("classes"),
  postId: Id("classroomPosts"),
  tenantId: Id("tenants"),
  votes: tallyValidator.fields.votes,
});

/** The votes of one announcement for one viewer: each choice with its count, and whether they took it. */
export const PostVotes = Schema.Struct({
  postId: Id("classroomPosts"),
  votes: Schema.Array(
    Schema.Struct({
      count: Schema.Int,
      mine: Schema.Boolean,
      option: Schema.Int,
    })
  ),
});

/** The sealed field of one part of a post's poll, bound to the post that holds it (ADR 0030). */
const pollField = (
  row: Pick<ClassroomPostsDoc, "classId" | "clientKey">,
  part: string
) => ({
  field: `poll:${part}`,
  row: [row.classId, row.clientKey],
  table: "classroomPosts",
});

/** The school's keys, as `schoolKeys` reads them. */
type Keys = Effect.Success<ReturnType<typeof schoolKeys>>;

/** The poll of a post with its words sealed under the post's key. */
export const sealPostPoll = Effect.fn("classroom.posts.sealPoll")(function* (
  keys: Keys,
  fields: Pick<ClassroomPostsDoc, "classId" | "clientKey">,
  poll: typeof PollDraft.Type
) {
  return {
    multiple: poll.multiple,
    sealedOptions: yield* Effect.forEach(poll.options, (option, index) =>
      sealText(keys, pollField(fields, `option:${index}`), option).pipe(
        Effect.orDie
      )
    ),
    sealedQuestion: yield* sealText(
      keys,
      pollField(fields, "question"),
      poll.question
    ).pipe(Effect.orDie),
  };
});

/** The poll of a post for a reader, its words opened with the school key. */
export const postPollView = Effect.fn("classroom.posts.pollView")(function* (
  keys: Keys,
  post: ClassroomPostsDoc
) {
  const { poll } = post;
  if (poll === undefined) {
    return null;
  }
  return {
    multiple: poll.multiple,
    options: yield* Effect.forEach(poll.sealedOptions, (sealed, index) =>
      openText(keys, pollField(post, `option:${index}`), sealed)
    ),
    question: yield* openText(
      keys,
      pollField(post, "question"),
      poll.sealedQuestion
    ),
  };
});
