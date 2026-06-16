import { LocaleSchema } from "@repo/contents/_types/content";
import {
  type MaterialKey,
  MaterialKeySchema,
} from "@repo/contents/_types/material/schema";
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

const CurriculumNodeTranslationMapSchema = Schema.Record({
  key: LocaleSchema,
  value: CurriculumNodeTranslationSchema,
});

export const CurriculumNodeSchema = Schema.Struct({
  key: CurriculumNodeKeySchema,
  level: ProgramNavigationLevelSchema,
  materialKeys: Schema.Array(MaterialKeySchema),
  order: Schema.Int.pipe(Schema.nonNegative()),
  parentKey: Schema.optional(CurriculumNodeKeySchema),
  translations: CurriculumNodeTranslationMapSchema,
});

export type CurriculumNode = SchemaType<typeof CurriculumNodeSchema>;
export type CurriculumNodeInput = SchemaEncoded<typeof CurriculumNodeSchema>;

export type CurriculumNodeTranslationMap = SchemaType<
  typeof CurriculumNodeTranslationMapSchema
>;

interface CurriculumStructureNodeValue {
  children?: readonly CurriculumTreeNodeValue[];
  key: string;
  level: CurriculumNode["level"];
  order: number;
  translations: CurriculumNodeTranslationMap;
}

interface CurriculumMaterialReferenceNodeValue {
  displayOverride?: CurriculumNodeTranslationMap;
  key: string;
  level: CurriculumNode["level"];
  materialKeys: readonly MaterialKey[];
  order: number;
}

type CurriculumTreeNodeValue =
  | CurriculumMaterialReferenceNodeValue
  | CurriculumStructureNodeValue;

export const CurriculumStructureNodeSchema = Schema.Struct({
  children: Schema.optional(
    Schema.Array(
      Schema.suspend(
        (): Schema.Schema<CurriculumTreeNodeValue> => CurriculumTreeNodeSchema
      )
    )
  ),
  key: CurriculumNodeKeySchema,
  level: ProgramNavigationLevelSchema,
  order: Schema.Int.pipe(Schema.nonNegative()),
  translations: CurriculumNodeTranslationMapSchema,
});

export const CurriculumMaterialReferenceNodeSchema = Schema.Struct({
  displayOverride: Schema.optional(CurriculumNodeTranslationMapSchema),
  key: CurriculumNodeKeySchema,
  level: ProgramNavigationLevelSchema,
  materialKeys: Schema.Array(MaterialKeySchema).pipe(Schema.minItems(1)),
  order: Schema.Int.pipe(Schema.nonNegative()),
});

export const CurriculumTreeNodeSchema: Schema.Schema<CurriculumTreeNodeValue> =
  Schema.Union(
    CurriculumMaterialReferenceNodeSchema,
    CurriculumStructureNodeSchema
  );

export type CurriculumStructureNode = SchemaType<
  typeof CurriculumStructureNodeSchema
>;

export type CurriculumMaterialReferenceNode = SchemaType<
  typeof CurriculumMaterialReferenceNodeSchema
>;

export type CurriculumTreeNode = SchemaType<typeof CurriculumTreeNodeSchema>;
export type CurriculumTreeNodeInput = SchemaEncoded<
  typeof CurriculumTreeNodeSchema
>;

export const CurriculumSourceSchema = Schema.Struct({
  programKey: LearningProgramKeySchema,
  tree: Schema.Array(CurriculumTreeNodeSchema),
});

export type CurriculumSource = SchemaType<typeof CurriculumSourceSchema>;
export type CurriculumSourceInput = SchemaEncoded<
  typeof CurriculumSourceSchema
>;

export class CurriculumSourceDefinitionError extends Schema.TaggedError<CurriculumSourceDefinitionError>()(
  "CurriculumSourceDefinitionError",
  {
    message: Schema.String,
  }
) {}

/** Decodes one nested curriculum tree at the authoring boundary. */
export function defineCurriculumTree(
  input: readonly CurriculumTreeNodeInput[]
) {
  return Schema.decodeUnknownSync(Schema.Array(CurriculumTreeNodeSchema))(
    input
  );
}

type StructureNodeInput = Omit<
  SchemaEncoded<typeof CurriculumStructureNodeSchema>,
  "level"
>;

type MaterialReferenceNodeInput = Omit<
  SchemaEncoded<typeof CurriculumMaterialReferenceNodeSchema>,
  "level"
> & {
  level: CurriculumNode["level"];
};

function structureNode(
  level: CurriculumNode["level"],
  input: StructureNodeInput
) {
  return Schema.decodeUnknownSync(CurriculumStructureNodeSchema)({
    ...input,
    level,
  });
}

/** Defines a class-level curriculum structure node. */
export function classNode(input: StructureNodeInput) {
  return structureNode("class", input);
}

/** Defines a subject-level curriculum structure node. */
export function subjectNode(input: StructureNodeInput) {
  return structureNode("subject", input);
}

/** Defines a course-level curriculum structure node. */
export function courseNode(input: StructureNodeInput) {
  return structureNode("course", input);
}

/** Defines a unit-level curriculum structure node. */
export function unitNode(input: StructureNodeInput) {
  return structureNode("unit", input);
}

/** Defines a material-reference curriculum leaf. */
export function materialNode(input: MaterialReferenceNodeInput) {
  return Schema.decodeUnknownSync(CurriculumMaterialReferenceNodeSchema)(input);
}

/** Decodes the source-controlled curriculum registry at the authoring boundary. */
export function defineCurriculumSources(
  input: readonly CurriculumSourceInput[]
) {
  return Schema.decodeUnknownSync(Schema.Array(CurriculumSourceSchema))(input);
}

/** Decodes one authored curriculum source at module load time. */
export function defineCurriculum(input: CurriculumSourceInput) {
  const curriculum = Schema.decodeUnknownSync(CurriculumSourceSchema)(input);
  const nodeKeys = new Set<string>();

  for (const node of flattenCurriculumTree(curriculum.tree)) {
    if (nodeKeys.has(node.key)) {
      throw new CurriculumSourceDefinitionError({
        message: `Duplicate curriculum node ${node.key} in ${curriculum.programKey}.`,
      });
    }

    nodeKeys.add(node.key);
  }

  return curriculum;
}

function flattenCurriculumTree(
  nodes: readonly CurriculumTreeNode[]
): CurriculumTreeNode[] {
  const flattened: CurriculumTreeNode[] = [];

  for (const node of nodes) {
    flattened.push(node);

    if ("children" in node && node.children) {
      flattened.push(...flattenCurriculumTree(node.children));
    }
  }

  return flattened;
}
