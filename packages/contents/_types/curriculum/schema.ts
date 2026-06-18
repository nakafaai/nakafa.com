import { LocaleSchema } from "@repo/contents/_types/content";
import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import {
  type MaterialKey,
  MaterialKeySchema,
} from "@repo/contents/_types/material/schema";
import {
  LearningProgramKeySchema,
  ProgramNavigationIconKeySchema,
  ProgramNavigationLevelSchema,
} from "@repo/contents/_types/program/schema";
import { PublicRouteSegmentSchema } from "@repo/contents/_types/route/segment";
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
  routeSlug: PublicRouteSegmentSchema,
  title: Schema.String,
});

export const CurriculumNodeTranslationMapSchema = Schema.Record({
  key: LocaleSchema,
  value: CurriculumNodeTranslationSchema,
});

export const CurriculumDisplayGroupTranslationSchema = Schema.Struct({
  title: Schema.String,
});

const CurriculumDisplayGroupTranslationMapSchema = Schema.Record({
  key: LocaleSchema,
  value: CurriculumDisplayGroupTranslationSchema,
});

export const CurriculumNodeSchema = Schema.Struct({
  displayGroup: Schema.optional(CurriculumDisplayGroupTranslationMapSchema),
  displayGroupIconKey: Schema.optional(ProgramNavigationIconKeySchema),
  iconKey: Schema.optional(ProgramNavigationIconKeySchema),
  key: CurriculumNodeKeySchema,
  level: ProgramNavigationLevelSchema,
  materialDomain: Schema.optional(MaterialSchema),
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
type CurriculumNodeTranslationEncodedMap = SchemaEncoded<
  typeof CurriculumNodeTranslationMapSchema
>;

/**
 * Private decoded recursion shape needed only to type `Schema.suspend`.
 *
 * Effect Schema cannot infer this recursive tree without a local alias. The
 * exported curriculum models below still derive from the runtime schemas.
 */
interface CurriculumStructureNodeValue {
  children?: readonly CurriculumTreeNodeValue[];
  displayGroup?: SchemaType<typeof CurriculumDisplayGroupTranslationMapSchema>;
  displayGroupIconKey?: SchemaType<typeof ProgramNavigationIconKeySchema>;
  iconKey?: SchemaType<typeof ProgramNavigationIconKeySchema>;
  key: string;
  level: CurriculumNode["level"];
  materialDomain?: CurriculumNode["materialDomain"];
  order: number;
  translations: CurriculumNodeTranslationMap;
}

/**
 * Private decoded material-leaf shape for the recursive curriculum union.
 *
 * This keeps the recursive schema annotation precise while the public material
 * leaf type remains schema-derived below.
 */
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

/**
 * Private encoded recursion shape needed only to type authored source input.
 *
 * The source helpers decode this shape through `CurriculumTreeNodeSchema`, so
 * callers never receive a parallel public contract.
 */
interface CurriculumStructureNodeEncodedValue {
  children?: readonly CurriculumTreeNodeEncodedValue[];
  displayGroup?: SchemaEncoded<
    typeof CurriculumDisplayGroupTranslationMapSchema
  >;
  displayGroupIconKey?: SchemaEncoded<typeof ProgramNavigationIconKeySchema>;
  iconKey?: SchemaEncoded<typeof ProgramNavigationIconKeySchema>;
  key: string;
  level: CurriculumNode["level"];
  materialDomain?: CurriculumNode["materialDomain"];
  order: number;
  translations: CurriculumNodeTranslationEncodedMap;
}

/**
 * Private encoded material-leaf shape for recursive authored curriculum input.
 *
 * This exists only so the recursive Effect Schema can type its encoded side.
 */
interface CurriculumMaterialReferenceNodeEncodedValue {
  displayOverride?: CurriculumNodeTranslationEncodedMap;
  key: string;
  level: CurriculumNode["level"];
  materialKeys: readonly string[];
  order: number;
}

type CurriculumTreeNodeEncodedValue =
  | CurriculumMaterialReferenceNodeEncodedValue
  | CurriculumStructureNodeEncodedValue;

export const CurriculumStructureNodeSchema = Schema.Struct({
  children: Schema.optional(
    Schema.Array(
      Schema.suspend(
        (): Schema.Schema<
          CurriculumTreeNodeValue,
          CurriculumTreeNodeEncodedValue
        > => CurriculumTreeNodeSchema
      )
    )
  ),
  displayGroup: Schema.optional(CurriculumDisplayGroupTranslationMapSchema),
  displayGroupIconKey: Schema.optional(ProgramNavigationIconKeySchema),
  iconKey: Schema.optional(ProgramNavigationIconKeySchema),
  key: CurriculumNodeKeySchema,
  level: ProgramNavigationLevelSchema,
  materialDomain: Schema.optional(MaterialSchema),
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

export const CurriculumTreeNodeSchema: Schema.Schema<
  CurriculumTreeNodeValue,
  CurriculumTreeNodeEncodedValue
> = Schema.Union(
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

/**
 * Decodes a structure node through the curriculum schema helper API so authored
 * trees keep branded keys, localized copy, and child ordering at the source.
 */
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

/** Defines an official stage-level curriculum structure node. */
export function stageNode(input: StructureNodeInput) {
  return structureNode("stage", input);
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

/**
 * Flattens nested curriculum authoring trees in pre-order so duplicate-key
 * validation and projection preserve the source-owned learning sequence.
 */
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
