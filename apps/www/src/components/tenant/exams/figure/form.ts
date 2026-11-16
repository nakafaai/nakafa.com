import {
  type FigureAttrs,
  FigureAttrsSchema,
} from "@nakafa/aksara-contracts/assessment/figure";
import type { RichText } from "@nakafa/aksara-contracts/assessment/inline";
import {
  assessmentVisuals,
  type VisualName,
  VisualNameSchema,
} from "@nakafa/aksara-contracts/visual/catalog";
import {
  Array as Arr,
  Match,
  Option,
  Predicate,
  Record as Rec,
  Result,
  Schema,
  SchemaAST,
  SchemaIssue,
  String as Str,
} from "effect";

/** A value a choice offers: a literal of the catalog schema. */
const OptionValueSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
]);

/** Checks whether a literal of a schema is a value a choice offers. */
const isOptionValue = Schema.is(OptionValueSchema);

/**
 * How the form edits one prop of a figure, read from the prop's catalog schema: a switch, a number,
 * plain text, rich text, one of fixed values, a group of named props, a list, one of several shapes
 * told apart by a tag, or JSON text for a shape no control fits. A recursive Schema needs its type
 * named in its own definition.
 */
export type Field =
  | { readonly kind: "boolean" | "json" | "number" | "rich" | "text" }
  | {
      readonly kind: "choice";
      readonly options: readonly (typeof OptionValueSchema.Type)[];
    }
  | {
      readonly kind: "group";
      readonly props: readonly {
        readonly field: Field;
        readonly name: string;
        readonly optional: boolean;
      }[];
    }
  | { readonly item: Field; readonly kind: "list" }
  | {
      readonly cases: readonly {
        readonly group: Group;
        readonly value: typeof OptionValueSchema.Type;
      }[];
      readonly kind: "variant";
      readonly tag: string;
    };

/** A group of named props, each with whether a figure may leave it out. */
type Group = Extract<Field, { readonly kind: "group" }>;

const FieldRef = Schema.suspend((): Schema.Codec<Field> => FieldSchema);

const GroupSchema: Schema.Codec<Group> = Schema.Struct({
  kind: Schema.Literal("group"),
  props: Schema.Array(
    Schema.Struct({
      field: FieldRef,
      name: Schema.String,
      optional: Schema.Boolean,
    })
  ),
});

/** The field of one prop, as data the form draws. */
export const FieldSchema: Schema.Codec<Field> = Schema.Union([
  Schema.Struct({
    kind: Schema.Literals(["boolean", "json", "number", "rich", "text"]),
  }),
  Schema.Struct({
    kind: Schema.Literal("choice"),
    options: Schema.Array(OptionValueSchema),
  }),
  GroupSchema,
  Schema.Struct({ item: FieldRef, kind: Schema.Literal("list") }),
  Schema.Struct({
    cases: Schema.Array(
      Schema.Struct({ group: GroupSchema, value: OptionValueSchema })
    ),
    kind: Schema.Literal("variant"),
    tag: Schema.String,
  }),
]);

/** The node types of rich text: words and inline math. */
const RICH_NODES: readonly unknown[] = ["mathInline", "text"];

/** The literal value a prop of an object holds, when it holds one. */
function tagValue(objects: SchemaAST.Objects, name: string) {
  return Option.flatMap(
    Arr.findFirst(objects.propertySignatures, (prop) => prop.name === name),
    ({ type }) =>
      SchemaAST.isLiteral(type) && isOptionValue(type.literal)
        ? Option.some(type.literal)
        : Option.none()
  );
}

/** Checks whether a schema is rich text: a list of words and inline math nodes. */
function isRich(ast: SchemaAST.AST) {
  const [item] = SchemaAST.isArrays(ast) ? ast.rest : [];
  return (
    item !== undefined &&
    SchemaAST.isUnion(item) &&
    Arr.every(
      item.types,
      (type) =>
        SchemaAST.isObjects(type) &&
        Option.exists(tagValue(type, "type"), (value) =>
          Arr.contains(RICH_NODES, value)
        )
    )
  );
}

/** The group of an object's props, each read as its own field. */
function groupOf(objects: SchemaAST.Objects): Group {
  return {
    kind: "group",
    props: Arr.map(objects.propertySignatures, (prop) => ({
      field: fieldOf(prop.type),
      name: String(prop.name),
      optional: SchemaAST.isOptional(prop.type),
    })),
  };
}

/** Reads a union of objects told apart by one literal prop they all hold as a variant. */
function variantOf(union: SchemaAST.Union): Option.Option<Field> {
  const objects = Arr.filter(union.types, SchemaAST.isObjects);
  const [first] = objects;
  if (first === undefined || objects.length !== union.types.length) {
    return Option.none();
  }
  return Arr.findFirst(first.propertySignatures, ({ name }) =>
    Option.map(
      Option.all(Arr.map(objects, (object) => tagValue(object, String(name)))),
      (values): Field => ({
        cases: Arr.zipWith(objects, values, (object, value) => ({
          group: groupOf(object),
          value,
        })),
        kind: "variant",
        tag: String(name),
      })
    )
  );
}

/** Reads a union: one of fixed values, a variant, or JSON text. */
function unionOf(union: SchemaAST.Union): Field {
  const literals = Arr.filterMap(union.types, (type) =>
    SchemaAST.isLiteral(type) && isOptionValue(type.literal)
      ? Result.succeed(type.literal)
      : Result.failVoid
  );
  if (literals.length === union.types.length) {
    return { kind: "choice", options: literals };
  }
  return Option.getOrElse(variantOf(union), (): Field => ({ kind: "json" }));
}

/** Reads how the form edits one schema of a figure's props. */
export function fieldOf(ast: SchemaAST.AST): Field {
  if (isRich(ast)) {
    return { kind: "rich" };
  }
  if (SchemaAST.isString(ast)) {
    return { kind: "text" };
  }
  if (SchemaAST.isNumber(ast)) {
    return { kind: "number" };
  }
  if (SchemaAST.isBoolean(ast)) {
    return { kind: "boolean" };
  }
  if (SchemaAST.isLiteral(ast) && isOptionValue(ast.literal)) {
    return { kind: "choice", options: [ast.literal] };
  }
  if (SchemaAST.isUnion(ast)) {
    return unionOf(ast);
  }
  if (
    SchemaAST.isObjects(ast) &&
    Arr.isReadonlyArrayEmpty(ast.indexSignatures)
  ) {
    return groupOf(ast);
  }
  const [item] =
    SchemaAST.isArrays(ast) && ast.elements.length <= 1 ? ast.rest : [];
  return item === undefined
    ? { kind: "json" }
    : { item: fieldOf(item), kind: "list" };
}

/** The form of one catalog figure's props. */
export function figureForm(component: VisualName) {
  return fieldOf(assessmentVisuals[component].props.ast);
}

/** The value of a new group: each prop a figure must hold, at its own start. */
function initialGroup(group: Group) {
  return Rec.fromEntries(
    Arr.filterMap(group.props, ({ field, name, optional }) =>
      optional ? Result.failVoid : Result.succeed([name, initialValue(field)])
    )
  );
}

/** The value a new field starts with: an empty switch, zero, empty text, or its first shape. */
export function initialValue(field: Field): unknown {
  return Match.value(field).pipe(
    Match.discriminatorsExhaustive("kind")({
      boolean: () => false,
      choice: ({ options }) => options[0],
      group: initialGroup,
      json: () => ({}),
      list: ({ item }) => [initialValue(item)],
      number: () => 0,
      rich: () => undefined,
      text: () => "",
      variant: (variant) => initialCase(variant, 0),
    })
  );
}

/** The value of one shape of a variant, with its tag set. */
export function initialCase(
  variant: Extract<Field, { readonly kind: "variant" }>,
  index: number
) {
  return Option.match(Arr.get(variant.cases, index), {
    onNone: () => ({}),
    onSome: ({ group, value }) =>
      Rec.set(initialGroup(group), variant.tag, value),
  });
}

/** Writes rich text as one line a teacher edits: words, and each formula between dollars. */
export function textOfRich(value: RichText | undefined) {
  return Arr.join(
    Arr.map(value ?? [], (node) =>
      node.type === "text" ? node.text : `$${node.attrs.latex}$`
    ),
    ""
  );
}

/** What splits a line into words and formulas: a formula is written between dollars. */
const FORMULA = /\$(?<latex>[^$]+)\$/u;

/** Reads one line a teacher wrote as rich text, or none when it holds nothing. */
export function richOfText(text: string): RichText | undefined {
  const nodes = Arr.filterMap(
    Str.split(text, FORMULA),
    (part, index): Result.Result<RichText[number], void> => {
      const latex = Str.trim(part);
      if (index % 2 === 1) {
        return Str.isNonEmpty(latex)
          ? Result.succeed({ attrs: { latex }, type: "mathInline" })
          : Result.failVoid;
      }
      return Str.isNonEmpty(part)
        ? Result.succeed({ text: part, type: "text" })
        : Result.failVoid;
    }
  );
  return Arr.isArrayNonEmpty(nodes) ? nodes : undefined;
}

/** One step into a value: the name of a prop or the place of an item. */
export const StepSchema = Schema.Union([Schema.String, Schema.Int]);

/** Reads the value at a path of the props, or `undefined` where none stands. */
export function getAt(
  value: unknown,
  path: readonly (typeof StepSchema.Type)[]
): unknown {
  return Arr.reduce(path, value, (current, step): unknown => {
    if (Arr.isArray(current)) {
      return Predicate.isNumber(step) ? current[step] : undefined;
    }
    return Predicate.isReadonlyObject(current) ? current[step] : undefined;
  });
}

/** Writes a prop's name as words for its label: `chooseAtom` reads as `Choose atom`. */
export function labelOf(name: string) {
  const words = Str.toLowerCase(
    name
      .replace(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, "$<lower> $<upper>")
      .replace(/[-_]/gu, " ")
  );
  return Str.capitalize(words);
}

/** Writes one value at a path of the props, leaving the rest as it was; `undefined` removes a prop. */
export function setAt(
  value: unknown,
  path: readonly (typeof StepSchema.Type)[],
  next: unknown
): unknown {
  const [step, ...rest] = path;
  if (step === undefined) {
    return next;
  }
  if (Predicate.isNumber(step)) {
    const list: readonly unknown[] = Arr.isArray(value) ? value : [];
    return Arr.map(list, (item, index) =>
      index === step ? setAt(item, rest, next) : item
    );
  }
  const record = Predicate.isReadonlyObject(value) ? value : {};
  const written = setAt(record[step], rest, next);
  return written === undefined
    ? Rec.remove(record, step)
    : Rec.set(record, step, written);
}

/** Formats the reason a figure's catalog schema refuses it, path by path. */
const formatIssue = SchemaIssue.makeFormatterDefault();

/** What a teacher writes for one figure: its component, its props, its words, and its caption. */
const FigureDraftSchema = Schema.Struct({
  alt: Schema.String,
  caption: Schema.String,
  component: VisualNameSchema,
  props: Schema.Unknown,
});
export type FigureDraft = typeof FigureDraftSchema.Type;

/**
 * Builds the figure a teacher wrote, checked against the catalog schema of its component, or the
 * reasons its schema refuses it.
 */
export function figureOf(draft: FigureDraft) {
  return Schema.decodeUnknownResult(FigureAttrsSchema)(
    {
      alt: Str.trim(draft.alt),
      caption: richOfText(draft.caption) ?? null,
      component: draft.component,
      props: draft.props,
    },
    { onExcessProperty: "error" }
  ).pipe(Result.mapError((error) => formatIssue(error.issue)));
}

/** The draft of a figure already in a text, which the teacher edits. */
export function draftOf(attrs: FigureAttrs): FigureDraft {
  return {
    alt: attrs.alt,
    caption: textOfRich(attrs.caption ?? undefined),
    component: attrs.component,
    props: attrs.props,
  };
}

/** The draft of a new figure of one component, each prop it must hold at its start. */
export function emptyDraft(component: VisualName): FigureDraft {
  return {
    alt: "",
    caption: "",
    component,
    props: initialValue(figureForm(component)),
  };
}
