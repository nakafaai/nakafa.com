import { Array as Arr, HashSet, Option, Result } from "effect";
import {
  isCallExpression,
  isConditionalExpression,
  isIdentifier,
  isImportDeclaration,
  isJsxAttribute,
  isJsxExpression,
  isJsxOpeningElement,
  isJsxSelfClosingElement,
  isParenthesizedExpression,
  isStringLiteral,
  isStringLiteralLikeNode,
  isTemplateExpression,
  type JsxAttributes,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow, tagText } from "#scripts/check/drilling";

/** The design system's primitives, which compose the picker from these parts and are the only modules that may. */
const PRIMITIVE_DIRECTORY = "packages/design-system/components/ui/";
const JSX_MODULE_PATTERN = /\.tsx$/u;
/** The raw searchable list, which only the picker and the command palette compose. */
const AUTOCOMPLETE_MODULE = "@repo/design-system/components/ui/autocomplete";
/** The command list, whose search and rows the command palette draws in its own dialog. */
const COMMAND_MODULE = "@repo/design-system/components/ui/command";
/** The surfaces a command list could be dropped into by hand, which the picker chooses by the screen's width. */
const SURFACE_MODULES = HashSet.make(
  "@repo/design-system/components/ui/popover",
  "@repo/design-system/components/ui/drawer",
  "@repo/design-system/components/ui/sheet",
  "@repo/design-system/components/ui/responsive-dialog"
);
const PICKER_TAG = "PickerContent";
const EMPTY_ATTRIBUTE = "empty";
/** A key of the empty family, alone or under its namespace, such as `locale-empty` or `Common.search-empty`. */
const EMPTY_KEY_PATTERN = /(?:^|[.-])empty$/u;

/** The modules a source imports, by their specifier, in the order it imports them. */
function importedModules(sourceFile: SourceFile) {
  return Arr.filterMap(sourceFile.statements, (statement) =>
    isImportDeclaration(statement) && isStringLiteral(statement.moduleSpecifier)
      ? Result.succeed(statement.moduleSpecifier.text)
      : Result.failVoid
  );
}

/** The expression or text a picker's empty sentence is written as, or none when it names none. */
function emptyOf(attributes: JsxAttributes) {
  return Arr.findFirst(
    attributes.properties,
    (property): Option.Option<Node> => {
      if (
        !(
          isJsxAttribute(property) &&
          isIdentifier(property.name) &&
          property.name.text === EMPTY_ATTRIBUTE &&
          property.initializer !== undefined
        )
      ) {
        return Option.none();
      }
      const { initializer } = property;
      return isJsxExpression(initializer)
        ? Option.fromNullishOr(initializer.expression)
        : Option.some(initializer);
    }
  );
}

/**
 * Whether a picker's empty sentence is written as text of its own rather than read from the empty family: a literal,
 * a template, or a lookup of any other key. Each branch of a choice between two sentences is judged alone. A sentence
 * the component receives from its caller passes, and its caller reads the key.
 */
function writesOwnEmpty(empty: Node): boolean {
  if (isStringLiteralLikeNode(empty) || isTemplateExpression(empty)) {
    return true;
  }
  if (isParenthesizedExpression(empty)) {
    return writesOwnEmpty(empty.expression);
  }
  if (isConditionalExpression(empty)) {
    return writesOwnEmpty(empty.whenTrue) || writesOwnEmpty(empty.whenFalse);
  }
  if (!isCallExpression(empty)) {
    return false;
  }
  const [key] = empty.arguments;
  return !(
    key !== undefined &&
    isStringLiteralLikeNode(key) &&
    EMPTY_KEY_PATTERN.test(key.text)
  );
}

/**
 * Reports a searchable choice built by hand. The picker draws one on every screen: a popover with the search over its
 * options on a wide screen, a drawer with the search at its top on a phone, the one-word label over the options, an
 * icon on each, and one sentence when nothing matches. So no module outside the design system's primitives imports the
 * raw autocomplete, or puts the command list in a popover, a drawer, a sheet or a dialog. A picker reads its empty
 * sentence from a key of the empty family, which the dictionary check holds to one sentence.
 */
export function inspectPickerSource(file: string, sourceFile: SourceFile) {
  if (file.startsWith(PRIMITIVE_DIRECTORY)) {
    return [];
  }
  const modules = importedModules(sourceFile);
  const surfaces = Arr.filter(modules, (module) =>
    HashSet.has(SURFACE_MODULES, module)
  );
  const commandSurfaces = Arr.contains(modules, COMMAND_MODULE) ? surfaces : [];
  const ownEmpties = JSX_MODULE_PATTERN.test(file)
    ? Arr.filter(
        nodesBelow(sourceFile),
        (node) =>
          (isJsxOpeningElement(node) || isJsxSelfClosingElement(node)) &&
          tagText(node.tagName) === PICKER_TAG &&
          Option.exists(emptyOf(node.attributes), writesOwnEmpty)
      )
    : [];
  return Arr.flatten([
    Arr.contains(modules, AUTOCOMPLETE_MODULE)
      ? [
          `${file}: imports the raw autocomplete of ${AUTOCOMPLETE_MODULE}. A searchable choice is a Picker, which draws its search, its label, its options and its empty sentence on every screen.`,
        ]
      : [],
    Arr.map(
      commandSurfaces,
      (surface) =>
        `${file}: puts the command list of ${COMMAND_MODULE} in ${surface}. A searchable choice is a Picker, which opens as a popover on a wide screen and as a drawer on a phone.`
    ),
    Arr.map(
      ownEmpties,
      () =>
        `${file}: a PickerContent writes its own empty sentence. Read it from a key of the empty family, which holds one sentence, such as empty={t("locale-empty")}.`
    ),
  ]);
}
