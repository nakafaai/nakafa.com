import { Array as Arr, HashSet, Option, Result } from "effect";
import {
  isArrowFunction,
  isBlock,
  isCallExpression,
  isExpressionStatement,
  isIdentifier,
  isImportDeclaration,
  isJsxAttribute,
  isJsxElement,
  isJsxExpression,
  isJsxSelfClosingElement,
  isStringLiteral,
  isStringLiteralLikeNode,
  type JsxAttributes,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow, tagText } from "#scripts/check/drilling";

/** The application code, which shows a dialog through the design system's ResponsiveDialog alone. */
const APPLICATION_PATTERN = /^apps\//u;
/** The raw parts of a dialog, which only the design system composes. */
const DIALOG_MODULES = HashSet.make(
  "@repo/design-system/components/ui/dialog",
  "@repo/design-system/components/ui/alert-dialog"
);

/** The one dialog of the application, whose footer holds the caller's actions alone. */
const DIALOG_TAG = "ResponsiveDialog";
/** The words of a way out, which the close in the corner already is. */
const WAY_OUT_KEYS = HashSet.make("cancel", "close");

/** The attributes of a ResponsiveDialog that a node opens. */
function dialogAttributes(node: Node) {
  if (isJsxElement(node)) {
    return tagText(node.openingElement.tagName) === DIALOG_TAG
      ? Option.some(node.openingElement.attributes)
      : Option.none();
  }
  return isJsxSelfClosingElement(node) && tagText(node.tagName) === DIALOG_TAG
    ? Option.some(node.attributes)
    : Option.none();
}

/** The expression in braces that an attribute holds. */
function attributeExpression(attributes: JsxAttributes, name: string) {
  return Arr.findFirst(attributes.properties, (property) =>
    isJsxAttribute(property) &&
    isIdentifier(property.name) &&
    property.name.text === name &&
    property.initializer !== undefined &&
    isJsxExpression(property.initializer) &&
    property.initializer.expression !== undefined
      ? Option.some<Node>(property.initializer.expression)
      : Option.none()
  );
}

/** Whether a node calls the dialog's `setOpen` and does nothing else. */
function closesOnly(node: Node, setOpen: Option.Option<string>) {
  return (
    isCallExpression(node) &&
    isIdentifier(node.expression) &&
    Option.contains(setOpen, node.expression.text)
  );
}

/**
 * Whether a node is a way out: a call that reads the words Cancel or Close, or a press whose one deed is to close the
 * dialog through the `setOpen` it was given. A press that acts and then closes the dialog is an action.
 */
function leaves(node: Node, setOpen: Option.Option<string>) {
  if (isArrowFunction(node)) {
    const statements = isBlock(node.body) ? node.body.statements : [];
    const deed = isBlock(node.body)
      ? Option.flatMap(
          Option.filter(Arr.head(statements), () => statements.length === 1),
          (statement) =>
            isExpressionStatement(statement)
              ? Option.some<Node>(statement.expression)
              : Option.none()
        )
      : Option.some<Node>(node.body);
    return Option.exists(deed, (called) => closesOnly(called, setOpen));
  }
  if (!isCallExpression(node)) {
    return false;
  }
  const [first] = node.arguments;
  return (
    first !== undefined &&
    isStringLiteralLikeNode(first) &&
    HashSet.has(WAY_OUT_KEYS, first.text)
  );
}

/** The findings of every ResponsiveDialog whose action repeats the close as a Cancel or a Close. */
function repeatedCloses(file: string, sourceFile: SourceFile) {
  return Arr.flatMap(nodesBelow(sourceFile), (node) =>
    Option.match(dialogAttributes(node), {
      onNone: () => [],
      onSome: (attributes) => {
        const setOpen = Option.flatMap(
          attributeExpression(attributes, "setOpen"),
          (value) =>
            isIdentifier(value) ? Option.some(value.text) : Option.none()
        );
        return Option.exists(
          attributeExpression(attributes, "action"),
          (action) =>
            Arr.some(Arr.prepend(nodesBelow(action), action), (below) =>
              leaves(below, setOpen)
            )
        )
          ? [
              `${file}: a dialog's footer repeats its close with Cancel or Close. The close in the corner, a swipe or a press outside already leave: pass only the dialog's own actions.`,
            ]
          : [];
      },
    })
  );
}

/**
 * Reports an application module that builds a dialog from its raw parts, or repeats a dialog's close in its footer.
 * ResponsiveDialog draws every dialog's header with its title and the close in the corner, requires its body, and
 * draws its footer with the caller's actions alone, so a dialog built from those parts directly could leave any of
 * them out, and a footer Cancel or Close says twice what the close already says.
 */
export function inspectDialogSource(file: string, sourceFile: SourceFile) {
  if (!APPLICATION_PATTERN.test(file)) {
    return [];
  }
  const raw = Arr.filterMap(sourceFile.statements, (statement) =>
    isImportDeclaration(statement) &&
    isStringLiteral(statement.moduleSpecifier) &&
    HashSet.has(DIALOG_MODULES, statement.moduleSpecifier.text)
      ? Result.succeed(
          `${file}: a dialog is built from the raw parts of ${statement.moduleSpecifier.text}. Show it through ResponsiveDialog, which draws its header, its close, its body and its footer.`
        )
      : Result.failVoid
  );
  return Arr.appendAll(raw, repeatedCloses(file, sourceFile));
}
