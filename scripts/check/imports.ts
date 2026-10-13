import { Array as Arr, Tuple } from "effect";
import {
  isIdentifier,
  isImportDeclaration,
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
        (element.propertyName ?? element.name).text === imported
          ? [element.name.text]
          : []
      )
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
