import { Array as Arr, Effect, HashSet, Order, Result } from "effect";
import {
  type BinaryExpression,
  type Identifier,
  isArrayLiteralExpression,
  isBinaryExpression,
  isCallExpression,
  isComputedPropertyName,
  isConditionalExpression,
  isElementAccessExpression,
  isIdentifier,
  isJsxAttribute,
  isJsxExpression,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSpreadAssignment,
  isSpreadElement,
  isStringLiteralLikeNode,
  isTemplateExpression,
  isVariableDeclaration,
  type JsxAttribute,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { CLASS_ATTRIBUTES, CLASS_FUNCTIONS } from "#scripts/check/editor";
import { isConfiguration, TEST_PATTERN } from "#scripts/check/kinds";
import {
  descendants,
  isGenerated,
  type parseSources,
  type TestCompilerError,
} from "#scripts/check/source";
import { unwrapped } from "#scripts/check/wrapper";

const ATTRIBUTES = HashSet.fromIterable(CLASS_ATTRIBUTES);
const FUNCTIONS = HashSet.fromIterable(CLASS_FUNCTIONS);
/** The operators whose two operands can both be classes. The right side of `&&` is one too. */
const JOINING_OPERATORS = HashSet.make(
  SyntaxKind.BarBarToken,
  SyntaxKind.PlusToken,
  SyntaxKind.QuestionQuestionToken
);
const FINDING_ORDER = Order.Struct({ file: Order.String, line: Order.Number });
const RULE =
  "write them inside cva(...) (one compoundVariants entry when several variants share them), inside cn(...), or in the className itself, or give the element a small component that owns them";

type Parsed = Effect.Success<ReturnType<typeof parseSources>>;
type Module = Parsed["modules"][number];

/** Returns the operands of a binary expression that can be classes. */
function classOperands(node: BinaryExpression) {
  const { kind } = node.operatorToken;
  if (kind === SyntaxKind.AmpersandAmpersandToken) {
    return [node.right];
  }
  return HashSet.has(JOINING_OPERATORS, kind) ? [node.left, node.right] : [];
}

/** Returns the name a reference starts from, such as `STYLES` in `STYLES.card[size]`. */
function rootName(node: Node): readonly Node[] {
  const value = unwrapped(node);
  if (isIdentifier(value)) {
    return [value];
  }
  return isPropertyAccessExpression(value) || isElementAccessExpression(value)
    ? rootName(value.expression)
    : [];
}

/** Returns the parts of one object member: its computed key, and its value or spread. */
function memberParts(member: Node): readonly Node[] {
  if (isPropertyAssignment(member)) {
    return Arr.appendAll(
      isComputedPropertyName(member.name)
        ? classParts(member.name.expression)
        : [],
      classParts(member.initializer)
    );
  }
  return isSpreadAssignment(member) ? classParts(member.expression) : [];
}

/**
 * Returns the parts a class value is made of. An identifier is the name it
 * reads, and a member chain such as `STYLES.card` is its root name. A string or
 * a template is class text written there. A branch, `||`, `??`, `+`, the right
 * side of `&&`, a template span, an array element, a spread, and an object key
 * or value hold more parts. A call or a function holds none, so `cn(...)` and
 * `cva(...)` results stay out.
 */
function classParts(node: Node): readonly Node[] {
  const value = unwrapped(node);
  if (isStringLiteralLikeNode(value)) {
    return [value];
  }
  if (isTemplateExpression(value)) {
    return Arr.prepend(
      Arr.flatMap(value.templateSpans, ({ expression }) =>
        classParts(expression)
      ),
      value
    );
  }
  if (
    isIdentifier(value) ||
    isPropertyAccessExpression(value) ||
    isElementAccessExpression(value)
  ) {
    return rootName(value);
  }
  if (isConditionalExpression(value)) {
    return Arr.appendAll(
      classParts(value.whenTrue),
      classParts(value.whenFalse)
    );
  }
  if (isBinaryExpression(value)) {
    return Arr.flatMap(classOperands(value), classParts);
  }
  if (isArrayLiteralExpression(value)) {
    return Arr.flatMap(value.elements, classParts);
  }
  if (isSpreadElement(value)) {
    return classParts(value.expression);
  }
  return isObjectLiteralExpression(value)
    ? Arr.flatMap(value.properties, memberParts)
    : [];
}

/** Returns the expression a class attribute holds between its braces. */
function attributeValue(attribute: JsxAttribute) {
  const { initializer, name } = attribute;
  return isIdentifier(name) &&
    HashSet.has(ATTRIBUTES, name.text) &&
    initializer !== undefined &&
    isJsxExpression(initializer) &&
    initializer.expression !== undefined
    ? [initializer.expression]
    : [];
}

/** Returns the names one module reads in its class values: class attributes and the arguments of class function calls. */
function classReferences(sourceFile: SourceFile) {
  return Arr.filter(
    Arr.flatMap(
      Arr.flatMap(descendants(sourceFile), (node) => {
        if (isJsxAttribute(node)) {
          return attributeValue(node);
        }
        if (!isCallExpression(node)) {
          return [];
        }
        const callee = unwrapped(node.expression);
        return isIdentifier(callee) && HashSet.has(FUNCTIONS, callee.text)
          ? node.arguments
          : [];
      }),
      classParts
    ),
    isIdentifier
  );
}

/**
 * Follows names from class values to the variables that declare them, and on
 * through the names those variables read, so a chain of constants is followed
 * to its end. Returns each variable once, with the parts of its value.
 */
const follow = Effect.fnUntraced(function* (
  declare: Parsed["declare"],
  pending: readonly {
    readonly module: Module;
    readonly reference: Identifier;
  }[],
  seen: readonly string[]
): Effect.fn.Return<
  readonly {
    readonly module: Module;
    readonly name: string;
    readonly node: Node;
    readonly parts: readonly Node[];
  }[],
  TestCompilerError
> {
  if (Arr.isReadonlyArrayEmpty(pending)) {
    return [];
  }
  const nodes = yield* declare(Arr.map(pending, ({ reference }) => reference));
  const declared = Arr.filterMap(
    Arr.zip(pending, nodes),
    ([{ module, reference }, node]) =>
      node !== undefined &&
      isVariableDeclaration(node) &&
      node.initializer !== undefined
        ? Result.succeed({
            key: `${module.file}:${node.pos}`,
            module,
            name: reference.text,
            node,
            parts: classParts(node.initializer),
          })
        : Result.failVoid
  );
  const fresh = Arr.filter(
    Arr.dedupeWith(declared, (left, right) => left.key === right.key),
    ({ key }) => !Arr.contains(seen, key)
  );
  const next = Arr.flatMap(fresh, ({ module, parts }) =>
    Arr.map(Arr.filter(parts, isIdentifier), (reference) => ({
      module,
      reference,
    }))
  );
  return Arr.appendAll(
    fresh,
    yield* follow(
      declare,
      next,
      Arr.appendAll(
        seen,
        Arr.map(fresh, ({ key }) => key)
      )
    )
  );
});

/**
 * Reports each variable that keeps class strings where the editor's Tailwind
 * language server cannot read them. A name read in a class position that the
 * compiler resolves, in its own module, to a variable whose value writes class
 * text is reported once, at the declaration: a string, a template, a
 * concatenation, a condition between strings, or an array or object that holds
 * them. A literal written in the class position, a `cn(...)` or `cva(...)`
 * result, a parameter, and an imported name are not reported, because the check
 * does not follow an import into the module that declares it.
 */
export const classFindings = Effect.fn("RepositoryPolicy.classFindings")(
  function* ({ declare, modules }: Parsed) {
    const judged = Arr.filter(
      modules,
      ({ file, sourceFile }) =>
        !(
          TEST_PATTERN.test(file) ||
          isConfiguration(file, sourceFile) ||
          isGenerated(sourceFile)
        )
    );
    const start = Arr.flatMap(judged, (module) =>
      Arr.map(classReferences(module.sourceFile), (reference) => ({
        module,
        reference,
      }))
    );
    const variables = yield* follow(declare, start, []);
    return Arr.map(
      Arr.sort(
        Arr.filterMap(variables, ({ module, name, node, parts }) =>
          // A part that is not an identifier is class text written there.
          Arr.some(parts, (part) => !isIdentifier(part))
            ? Result.succeed({
                file: module.file,
                line:
                  module.sourceFile.getLineAndCharacterOfPosition(
                    node.getStart(module.sourceFile)
                  ).line + 1,
                name,
              })
            : Result.failVoid
        ),
        FINDING_ORDER
      ),
      ({ file, line, name }) =>
        `${file}:${line}: ${name} keeps class strings in a constant, where the Tailwind language server cannot read them: ${RULE}.`
    );
  }
);
