import { LocaleSchema } from "@repo/contents/_types/content";
import { MaterialKeySchema } from "@repo/contents/_types/material/schema";
import {
  LearningProgramKeySchema,
  ProgramNavigationLevelSchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Schema.Any> = Schema.Schema.Encoded<T>;

const CURRICULUM_NODE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CurriculumNodeKeySchema = Schema.String.pipe(
  Schema.pattern(CURRICULUM_NODE_KEY_PATTERN, {
    identifier: "CurriculumNodeKey",
    description: "Lowercase kebab-case curriculum outline node key.",
    message: () => "Invalid curriculum node key.",
  })
);

export const CurriculumNodeTranslationSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  title: Schema.String,
});

export const CurriculumNodeSchema = Schema.Struct({
  key: CurriculumNodeKeySchema,
  level: ProgramNavigationLevelSchema,
  materialKeys: Schema.Array(MaterialKeySchema),
  order: Schema.Int.pipe(Schema.nonNegative()),
  parentKey: Schema.optional(CurriculumNodeKeySchema),
  translations: Schema.Record({
    key: LocaleSchema,
    value: CurriculumNodeTranslationSchema,
  }),
});

export type CurriculumNode = SchemaType<typeof CurriculumNodeSchema>;
export type CurriculumNodeInput = SchemaEncoded<typeof CurriculumNodeSchema>;

export const CurriculumSourceSchema = Schema.Struct({
  nodes: Schema.Array(CurriculumNodeSchema),
  programKey: LearningProgramKeySchema,
});

export type CurriculumSource = SchemaType<typeof CurriculumSourceSchema>;
export type CurriculumSourceInput = SchemaEncoded<
  typeof CurriculumSourceSchema
>;

/** Decodes one authored curriculum source at module load time. */
export function defineCurriculum(input: CurriculumSourceInput) {
  return Schema.decodeUnknownSync(CurriculumSourceSchema)(input);
}
