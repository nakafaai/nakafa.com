import { Id } from "@repo/backend/confect/_generated/id";
import { MascotCode } from "@repo/mascot/code";
import { Array as Arr, Schema } from "effect";

/**
 * One person as the forum draws them beside a message and in a thread's summary: their name, their animal, and the
 * photo their account shows, or Nina for her replies, which the Person who asked carries. A Person without an
 * account, such as one whose account was deleted, keeps an animal of their own ID, so they never lose a face.
 */
export const Face = Schema.Struct({
  id: Id("tenantPeople"),
  mascot: MascotCode,
  name: Schema.String,
  nina: Schema.Boolean,
  photo: Schema.NullOr(Schema.String),
});

/** Who answered in a thread, as its row keeps them: a Person, or Nina with the Person who asked her. */
export const Replier = Schema.Union([
  Schema.TaggedStruct("person", { id: Id("tenantPeople") }),
  Schema.TaggedStruct("nina", { askedBy: Id("tenantPeople") }),
]);

/** How many repliers a thread keeps and its summary shows, newest first, as Slack's row does. */
export const REPLIER_LIMIT = 3;

/** The repliers a thread keeps: the newest first, each once, at most `REPLIER_LIMIT`. */
export const Repliers = Schema.Array(Replier).check(
  Schema.isMaxLength(REPLIER_LIMIT)
);

/**
 * The repliers of a thread after `replier` answered: the newest first, each once, at most `REPLIER_LIMIT`. Nina counts
 * once, whoever asked her. A thread that kept none yet, as one before its first reply, starts the list.
 */
export const nextRepliers = (
  kept: readonly (typeof Replier.Type)[] | undefined,
  replier: typeof Replier.Type
): (typeof Replier.Type)[] =>
  Arr.take(
    Arr.prepend(
      Arr.filter(kept ?? [], (found) =>
        replier._tag === "nina"
          ? found._tag !== "nina"
          : found._tag !== "person" || found.id !== replier.id
      ),
      replier
    ),
    REPLIER_LIMIT
  );

/** The Persons that some repliers name, the Person who asked Nina among them. */
export const replierPeople = (repliers: readonly (typeof Replier.Type)[]) =>
  Arr.map(repliers, (replier) =>
    replier._tag === "person" ? replier.id : replier.askedBy
  );
