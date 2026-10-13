import { Array as Arr, Tuple } from "effect";
import {
  type ImportSpecifier,
  isExportDeclaration,
  isExportSpecifier,
  isIdentifier,
  isImportDeclaration,
  isImportSpecifier,
  isNamedImports,
  isPropertyAccessExpression,
  isStringLiteral,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { loadsImport } from "#scripts/check/kinds";

/**
 * Returns each import declaration of a module that loads `matches` at run time
 * and binds named imports only, paired with those imports.
 */
export function namedImports(
  sourceFile: SourceFile,
  matches: (specifier: string) => boolean
) {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        loadsImport(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        matches(statement.moduleSpecifier.text)
      )
    ) {
      return [];
    }
    const bindings = statement.importClause?.namedBindings;
    return statement.importClause?.name === undefined &&
      bindings !== undefined &&
      isNamedImports(bindings)
      ? [Tuple.make(statement, bindings.elements)]
      : [];
  });
}

/**
 * Returns the export that an import specifier binds, so `sign as signBytes`
 * yields `sign`, and `sign` alone does too.
 */
export function importedName(element: ImportSpecifier) {
  return (element.propertyName ?? element.name).text;
}

/**
 * Returns the local names a module gives to the export `imported` of the
 * package `from`, so `import { Layer as L } from "effect"` yields `L` for
 * `Layer`.
 */
export function importedNames(
  sourceFile: SourceFile,
  from: string,
  imported: string
) {
  return Arr.flatMap(
    namedImports(sourceFile, (specifier) => specifier === from),
    ([, elements]) =>
      Arr.flatMap(elements, (element) =>
        importedName(element) === imported ? [element.name.text] : []
      )
  );
}

/**
 * Whether a node is a name in `export { name } from "module"`, which names an
 * export of that module and reads no binding of this one.
 */
function namesReexport(node: Node) {
  const specifier = node.parent;
  return (
    isExportSpecifier(specifier) &&
    isExportDeclaration(specifier.parent.parent) &&
    specifier.parent.parent.moduleSpecifier !== undefined
  );
}

/**
 * Returns the identifiers that read a local name: a call, an alias, a handover
 * to another function, and an export of the binding are all reads. The import
 * that binds the name is none, a name in a re-export from another module is
 * none, and neither is a member of that name on another object, such as
 * `factory.sign`.
 */
export function readsOf(nodes: readonly Node[], name: string) {
  return Arr.filter(
    nodes,
    (node) =>
      isIdentifier(node) &&
      node.text === name &&
      !isImportSpecifier(node.parent) &&
      !namesReexport(node) &&
      !(isPropertyAccessExpression(node.parent) && node.parent.name === node)
  );
}

/** Whether a node reads `member` of one of the namespaces `owners`, such as `Context.Service`. */
export function readsMember(
  node: Node,
  owners: readonly string[],
  member: (name: string) => boolean
) {
  return (
    isPropertyAccessExpression(node) &&
    isIdentifier(node.expression) &&
    Arr.contains(owners, node.expression.text) &&
    member(node.name.text)
  );
}
