import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";

/** The most different emoji one message carries, so a message's row stays small. */
export const REACTION_LIMIT = 20;

/** One emoji, as the picker gives it: a short text that holds a pictograph, a flag or a keycap. */
export const Emoji = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(32),
  Schema.isPattern(/\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u)
);

/** The ID of a Person who reacted or voted. */
const PersonId = Id("tenantPeople");

/** One emoji of a message, and who gave it. */
const ReactionRow = Schema.Struct({
  emoji: Emoji,
  people: Schema.Array(PersonId),
});

/** One choice of a poll by its place, and who took it. */
const VoteRow = Schema.Struct({
  option: Schema.Int,
  people: Schema.Array(PersonId),
});

/**
 * Who reacted to one message and who voted in its poll. These live apart from the
 * message, one row a message and only once it holds one: a page of messages stays
 * still while a class reacts, and each reader's small read of the tallies runs
 * again in its place, so a burst of votes never reads the page again. `messageAt`
 * and `threadId` keep the place of the message, which is how a reader reads the
 * tallies of what it has loaded.
 */
export const tallyValidator = Schema.Struct({
  channelId: Id("classroomChannels"),
  classId: Id("classes"),
  messageAt: Schema.Finite,
  messageId: Id("classroomMessages"),
  reactions: Schema.Array(ReactionRow),
  tenantId: Id("tenants"),
  threadId: Schema.optionalKey(Id("classroomThreads")),
  votes: Schema.Array(VoteRow),
});

/** The tally of one message for one viewer: each emoji and each choice with its count, and whether the viewer took it. */
export const TallyView = Schema.Struct({
  messageId: Id("classroomMessages"),
  reactions: Schema.Array(
    Schema.Struct({
      count: Schema.Int,
      emoji: Emoji,
      mine: Schema.Boolean,
    })
  ),
  votes: Schema.Array(
    Schema.Struct({
      count: Schema.Int,
      mine: Schema.Boolean,
      option: Schema.Int,
    })
  ),
});

/** The tally of one stored row for one viewer. */
export const tallyView = (
  row: typeof tallyValidator.Type,
  person: string
): typeof TallyView.Type => ({
  messageId: row.messageId,
  reactions: Arr.map(row.reactions, ({ emoji, people }) => ({
    count: people.length,
    emoji,
    mine: Arr.contains(people, person),
  })),
  votes: Arr.map(row.votes, ({ option, people }) => ({
    count: people.length,
    mine: Arr.contains(people, person),
    option,
  })),
});

/** The reactions with `person` added to the emoji, or taken from it when they gave it. An emoji nobody gives leaves. */
export const toggleReaction = (
  rows: (typeof tallyValidator.Type)["reactions"],
  emoji: typeof Emoji.Type,
  person: typeof PersonId.Type
): (typeof tallyValidator.Type)["reactions"] =>
  Arr.some(rows, (row) => row.emoji === emoji)
    ? Arr.filter(
        Arr.map(rows, (row) =>
          row.emoji === emoji
            ? {
                emoji,
                people: Arr.contains(row.people, person)
                  ? Arr.filter(row.people, (found) => found !== person)
                  : Arr.append(row.people, person),
              }
            : row
        ),
        (row) => Arr.isReadonlyArrayNonEmpty(row.people)
      )
    : Arr.append(rows, { emoji, people: [person] });

/** The votes with `person` on the chosen options alone. An option nobody takes leaves. */
export const castVote = (
  rows: (typeof tallyValidator.Type)["votes"],
  options: readonly number[],
  person: typeof PersonId.Type
): (typeof tallyValidator.Type)["votes"] => {
  const others = Arr.filter(
    Arr.map(rows, (row) => ({
      option: row.option,
      people: Arr.filter(row.people, (found) => found !== person),
    })),
    (row) => Arr.isReadonlyArrayNonEmpty(row.people)
  );
  return Arr.reduce(options, others, (votes, option) =>
    Arr.some(votes, (row) => row.option === option)
      ? Arr.map(votes, (row) =>
          row.option === option
            ? { option, people: Arr.append(row.people, person) }
            : row
        )
      : Arr.append(votes, { option, people: [person] })
  );
};
