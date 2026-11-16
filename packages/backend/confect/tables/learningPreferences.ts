import { Table } from "@confect/core";
import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /**
     * The moment the learner last asked to delete every Nina memory. The
     * memories are deleted in batches after that, so every reader drops what was
     * confirmed at or before this moment in the meantime. Absent means the
     * learner never asked.
     */
    ninaMemoryClearedAt: Schema.optionalKey(Schema.Finite),
    /** Present when the learner paused Nina's memory; absent means memory is on. */
    ninaMemoryPaused: Schema.optionalKey(Schema.Literal(true)),
    preferredCurriculumProgramKey: Schema.optionalKey(Schema.String),
    preferredTryoutCountryKey: Schema.optionalKey(Schema.String),
    /**
     * The language the learner last chose to read each exam's questions in, one entry per country and
     * exam, written by every explicit choice: on a section page and in a running section. A section
     * of the exam opens on it when its questions are written in it. Absent means no choice yet.
     */
    questionLanguages: Schema.optionalKey(
      Schema.Array(
        Schema.Struct({
          countryKey: Schema.String,
          examKey: Schema.String,
          language: ContentLanguageSchema,
        })
      )
    ),
    updatedAt: Schema.Finite,
    userId: IdSchema("users"),
  })
).index("by_userId", ["userId"]);
