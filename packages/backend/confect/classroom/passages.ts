import { Id } from "@repo/backend/confect/_generated/id";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Array as Arr, Option, Schema, String as Str } from "effect";

/** The most characters one passage holds: a page of a handout, which an answer can quote. */
const PASSAGE_LENGTH = 1200;

/** The passages one file keeps: about 30 dense pages, and a longer file keeps its start. */
export const MAX_PASSAGES = 40;

/** The largest file Nina reads: a scan of a long handout, and a larger one stays out of the index. */
export const MAX_READ_BYTES = 20 * 1024 * 1024;

/** The passages one question reads. */
export const SEARCH_LIMIT = 4;

/** What the model is told when it reads a teacher's file into text. */
export const READ_INSTRUCTIONS = Arr.join(
  [
    "You read a file a teacher published to their class, so a class assistant can search it.",
    "Write out the text of the file in its own language, in reading order, with a blank line between paragraphs.",
    "Describe a figure in one sentence where it stands. Add nothing else, and answer with the text alone.",
  ],
  "\n"
);

/** One passage of a published file, with its vector. Deleting these rows loses nothing, because a build makes them again (ADR 0023). */
export const classroomPassageValidator = Schema.Struct({
  classId: Id("classes"),
  embedding: Schema.Array(Schema.Finite),
  itemId: Id("classroomLibrary"),
  ordinal: Schema.Int,
  sealedText: Sealed,
  tenantId: Id("tenants"),
});

/** The sealed field of a passage, bound to its file and its place (ADR 0030). */
export const passageField = (
  row: Pick<typeof classroomPassageValidator.Type, "itemId" | "ordinal">
) => ({
  field: "sealedText",
  row: [row.itemId, row.ordinal],
  table: "classroomPassages",
});

/** One passage as an answer reads it: the file's title and the text. */
export const PassageView = Schema.Struct({
  text: Schema.String,
  title: Schema.String,
});

/** One paragraph in pieces a passage can hold. */
const piecesOf = (paragraph: string) =>
  Arr.map(
    Arr.range(0, Math.floor((paragraph.length - 1) / PASSAGE_LENGTH)),
    (index) =>
      Str.slice(index * PASSAGE_LENGTH, (index + 1) * PASSAGE_LENGTH)(paragraph)
  );

/** A file's text as passages: its paragraphs in order, each passage as full as a paragraph allows. */
export const passagesOf = (text: string) =>
  Arr.take(
    Arr.reduce(
      Arr.flatMap(
        Arr.filter(Arr.map(Str.split("\n\n")(text), Str.trim), Str.isNonEmpty),
        piecesOf
      ),
      Arr.empty<string>(),
      (passages, piece) =>
        Option.match(Arr.last(passages), {
          onNone: () => [piece],
          onSome: (last) =>
            last.length + piece.length + 2 > PASSAGE_LENGTH
              ? Arr.append(passages, piece)
              : Arr.append(Arr.dropRight(passages, 1), `${last}\n\n${piece}`),
        })
    ),
    MAX_PASSAGES
  );

/** What the teacher's files say on a question, ahead of Nakafa's sources in a prompt. */
export const sourcesOf = (
  passages: readonly (typeof PassageView.Type)[],
  nakafa: string
) =>
  Arr.join(
    Arr.append(
      Arr.map(
        passages,
        ({ text, title }) => `From the teacher's file "${title}":\n${text}`
      ),
      nakafa
    ),
    "\n\n"
  );
