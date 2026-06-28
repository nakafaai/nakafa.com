import { LocaleSchema } from "@repo/contents/_types/content";
import { MaterialKeySchema } from "@repo/contents/_types/material/schema";
import {
  LearningProgramKeySchema,
  ProgramNavigationLevelSchema,
} from "@repo/contents/_types/program/schema";
import { PublicRouteSegmentSchema } from "@repo/contents/_types/route/segment";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Schema.Any> = Schema.Schema.Encoded<T>;

const ASSESSMENT_NODE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const AssessmentNodeKeySchema = Schema.String.pipe(
  Schema.pattern(ASSESSMENT_NODE_KEY_PATTERN, {
    identifier: "AssessmentNodeKey",
    description: "Lowercase kebab-case assessment outline node key.",
    message: () => "Invalid assessment node key.",
  })
);

export const AssessmentNodeTranslationSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  routeSlug: PublicRouteSegmentSchema,
  title: Schema.String,
});

export const AssessmentNodeSchema = Schema.Struct({
  key: AssessmentNodeKeySchema,
  level: ProgramNavigationLevelSchema,
  materialKeys: Schema.Array(MaterialKeySchema),
  order: Schema.Int.pipe(Schema.nonNegative()),
  parentKey: Schema.optional(AssessmentNodeKeySchema),
  translations: Schema.Record({
    key: LocaleSchema,
    value: AssessmentNodeTranslationSchema,
  }),
});

export type AssessmentNode = SchemaType<typeof AssessmentNodeSchema>;
export type AssessmentNodeInput = SchemaEncoded<typeof AssessmentNodeSchema>;

export const AssessmentSourceSchema = Schema.Struct({
  nodes: Schema.Array(AssessmentNodeSchema),
  programKey: LearningProgramKeySchema,
});

export type AssessmentSource = SchemaType<typeof AssessmentSourceSchema>;
export type AssessmentSourceInput = SchemaEncoded<
  typeof AssessmentSourceSchema
>;

/** Decodes one authored assessment source at module load time. */
export function defineAssessment(input: AssessmentSourceInput) {
  return Schema.decodeUnknownSync(AssessmentSourceSchema)(input);
}
