import { Array as Arr, HashSet, Option } from "effect";
import {
  isCallExpression,
  isIdentifier,
  isNewExpression,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { TEST_PATTERN } from "#scripts/check/kinds";
import { descendants } from "#scripts/check/source";

/** The modules of the locale module that build the platform formatters: the only ones that may. */
const FORMAT_MODULES = HashSet.make(
  "packages/internationalization/src/formats.ts",
  "packages/internationalization/src/money.ts"
);

/** The platform formatters that write dates, numbers, relative times, lists and plurals. */
const FORMATTERS = HashSet.make(
  "DateTimeFormat",
  "ListFormat",
  "NumberFormat",
  "PluralRules",
  "RelativeTimeFormat"
);

/** The use-intl formatter methods that take a format name as their second argument. */
const NAMED_METHODS = HashSet.make(
  "dateTime",
  "dateTimeRange",
  "list",
  "number"
);

/** The calls that give a use-intl formatter: the React hook, the locale module's, and use-intl's own. */
const FORMATTER_SOURCES = HashSet.make(
  "createFormatter",
  "formatterOf",
  "useFormatter"
);

/** A Playwright spec, which computes the words it expects with the platform as a unit test does. */
const BROWSER_SPEC_PATTERN = /\.browser\.ts$/u;

const BUILD_RULE =
  "write it with useFormatter or formatterOf and a FORMATS name from @repo/internationalization/src/formats, or a price with formatCurrency from @repo/internationalization/src/money, instead of building an Intl formatter";
const NAME_RULE =
  "name a format of FORMATS from @repo/internationalization/src/formats as the second argument instead of writing its options, and pass an override such as a time zone third";

/**
 * Whether `node` builds a platform formatter, as in `new Intl.NumberFormat()`
 * or `Intl.DateTimeFormat()`. A call that only reads the resolved options, as
 * `Intl.DateTimeFormat().resolvedOptions()` reads the viewer's zone, writes
 * nothing, so it is not one.
 */
function buildsFormatter(node: Node) {
  if (!(isNewExpression(node) || isCallExpression(node))) {
    return false;
  }
  const callee = node.expression;
  const builds =
    isPropertyAccessExpression(callee) &&
    isIdentifier(callee.expression) &&
    callee.expression.text === "Intl" &&
    HashSet.has(FORMATTERS, callee.name.text);
  const reader = node.parent;
  const readsOptions =
    isPropertyAccessExpression(reader) &&
    reader.name.text === "resolvedOptions";
  return builds && !readsOptions;
}

/** Whether `node` is a call that gives a use-intl formatter, such as `useFormatter()`. */
function givesFormatter(node: Node) {
  return (
    isCallExpression(node) &&
    isIdentifier(node.expression) &&
    HashSet.has(FORMATTER_SOURCES, node.expression.text)
  );
}

/** The names that a module binds to a use-intl formatter, as `const format = useFormatter()` does. */
function formatterNames(nodes: readonly Node[]) {
  return HashSet.fromIterable(
    Arr.flatMap(nodes, (node) =>
      isVariableDeclaration(node) &&
      isIdentifier(node.name) &&
      node.initializer !== undefined &&
      givesFormatter(node.initializer)
        ? [node.name.text]
        : []
    )
  );
}

/**
 * Whether `node` hands a use-intl formatter the options of a format instead of
 * its name, as in `format.dateTime(at, { dateStyle: "medium" })`. Only a
 * formatter counts, so a table's `columns.number(read, { header })` does not.
 */
function writesOptions(node: Node, names: HashSet.HashSet<string>) {
  if (
    !(isCallExpression(node) && isPropertyAccessExpression(node.expression))
  ) {
    return false;
  }
  const receiver = node.expression.expression;
  const formatter =
    givesFormatter(receiver) ||
    (isIdentifier(receiver) && HashSet.has(names, receiver.text));
  return (
    formatter &&
    HashSet.has(NAMED_METHODS, node.expression.name.text) &&
    Option.exists(Arr.get(node.arguments, 1), isObjectLiteralExpression)
  );
}

/** The rule that `node` breaks, if any, given the module's formatter names. */
function ruleAt(node: Node, names: HashSet.HashSet<string>) {
  if (buildsFormatter(node)) {
    return Option.some(BUILD_RULE);
  }
  return writesOptions(node, names) ? Option.some(NAME_RULE) : Option.none();
}

/**
 * Reports what the types cannot state about the locale module: a platform
 * formatter built outside it, and a format written as options at a call
 * instead of named from `FORMATS`. One module then owns how every date and
 * number is written, a new locale is complete once it has its dictionary and
 * its time zone, and two pages never write one shape two ways. Tests and
 * Playwright specs are not judged, because they compute the words they
 * expect with the platform.
 */
export function inspectFormatSource(file: string, sourceFile: SourceFile) {
  if (
    TEST_PATTERN.test(file) ||
    BROWSER_SPEC_PATTERN.test(file) ||
    HashSet.has(FORMAT_MODULES, file)
  ) {
    return [];
  }
  const nodes = descendants(sourceFile);
  const names = formatterNames(nodes);
  return Arr.flatMap(nodes, (node) =>
    Option.match(ruleAt(node, names), {
      onNone: () => [],
      onSome: (rule) => {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        );
        return [`${file}:${line + 1}: ${rule}.`];
      },
    })
  );
}
