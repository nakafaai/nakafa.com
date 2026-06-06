import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { NakafaAgentContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import { Option, Schema } from "effect";

/** Content reference input accepted by the structured exercise reader. */
const NakafaAgentExerciseContentRefInputSchema =
  NakafaAgentContentRefInputSchema.pipe(
    Schema.filter(
      (value) => {
        const ref = parseNakafaContentRef(value);

        if (Option.isNone(ref)) {
          return false;
        }

        return ref.value.section === "exercises";
      },
      {
        message: () =>
          'Expected a Nakafa exercise content reference with section "exercises".',
      }
    )
  );

/** Runtime schema for exercise read input. */
export const NakafaAgentExerciseOptionsSchema = Schema.Struct({
  content_ref: NakafaAgentExerciseContentRefInputSchema,
  exercise_number: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
      description: "Optional exercise number inside the set.",
    })
  ),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa exercise read options." });

/** Runtime schema for one exercise choice. */
const NakafaAgentExerciseChoiceSchema = Schema.Struct({
  correct: Schema.Boolean.annotations({
    description: "Whether this choice is the correct answer.",
  }),
  label: Schema.String.annotations({
    description: "Choice label exactly as published.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa exercise choice." });

const NakafaAgentExerciseContentSchema = Schema.Struct({
  raw: Schema.String,
  title: Schema.String,
}).pipe(Schema.mutable);

/** Runtime schema for one exercise question and explanation. */
const NakafaAgentExerciseItemSchema = Schema.Struct({
  answer: NakafaAgentExerciseContentSchema.annotations({
    description: "Published answer and explanation.",
  }),
  choices: Schema.Array(NakafaAgentExerciseChoiceSchema)
    .pipe(Schema.mutable)
    .annotations({ description: "Multiple-choice answer options." }),
  number: Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
    description: "Exercise number inside the set.",
  }),
  question: NakafaAgentExerciseContentSchema.annotations({
    description: "Published question content.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Structured Nakafa exercise item." });

/** Runtime schema for exercise retrieval output. */
export const NakafaAgentExerciseResultSchema = NakafaAgentContentRefSchema.pipe(
  Schema.extend(
    Schema.Struct({
      count: Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
        description: "Number of returned exercises.",
      }),
      exercise_number: Schema.optional(
        Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
          description: "Requested exercise number inside the set.",
        })
      ),
      exercises: Schema.Array(NakafaAgentExerciseItemSchema)
        .pipe(Schema.minItems(1), Schema.mutable)
        .annotations({ description: "Structured exercises." }),
    })
  ),
  Schema.mutable
).annotations({
  description: "Nakafa exercise set or single exercise result.",
});

export type NakafaAgentExerciseOptions = Schema.Schema.Type<
  typeof NakafaAgentExerciseOptionsSchema
>;
export type NakafaAgentExerciseItem = Schema.Schema.Type<
  typeof NakafaAgentExerciseItemSchema
>;
export type NakafaAgentExerciseResult = Schema.Schema.Type<
  typeof NakafaAgentExerciseResultSchema
>;
