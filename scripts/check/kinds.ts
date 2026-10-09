import { Array as Arr } from "effect";
import {
  type ExportDeclaration,
  type ImportDeclaration,
  isExportAssignment,
  isExportDeclaration,
  isExpressionStatement,
  isIdentifier,
  isImportDeclaration,
  isNamedExports,
  isNamedImports,
  isSatisfiesExpression,
  isStringLiteral,
  isTypeReferenceNode,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";

const CONFIGURATION_FILE_PATTERN = /(?:^|\/)[^/]+\.config\.[cm]?tsx?$/u;
/**
 * The configuration APIs that framework configuration imports: Vitest's, and
 * Vercel's by any of its subpaths.
 */
const CONFIGURATION_MODULE_PATTERN =
  /^(?:vitest\/config|@vercel\/config(?:\/.*)?)$/u;
/** The strict folders, where Confect and script code must compose Effect. */
export const STRICT_PATTERN = /^(?:packages\/backend\/confect|scripts)\//u;
/** Tests and the `test.*.ts` modules that set up and support them. */
export const TEST_PATTERN = /(?:\.test\.tsx?|(?:^|\/)test\.[^/]+\.ts)$/u;
const JSX_PATTERN = /\.tsx$/u;
const REACT_PATTERN = /^react(?:-dom)?(?:\/|$)/u;
/** Framework configuration types name what they configure, such as `NextConfig` or Convex's `AuthConfig`. */
const CONFIGURATION_TYPE_PATTERN = /Config$/u;
/** Relative paths, app aliases, and workspace packages name repository modules rather than framework packages. */
const REPOSITORY_SPECIFIER_PATTERN = /^(?:\.|@\/|@repo\/|#)/u;
/** The directive that opens a client module, which must be the module's first statement. */
const CLIENT_DIRECTIVE = "use client";

/** Whether a module imports a module specifier that `pattern` matches. */
export function imports(sourceFile: SourceFile, pattern: RegExp) {
  return Arr.some(
    sourceFile.statements,
    (statement) =>
      isImportDeclaration(statement) &&
      isStringLiteral(statement.moduleSpecifier) &&
      pattern.test(statement.moduleSpecifier.text)
  );
}

/** Whether a module imports `name` by a named import from a framework package. */
function importsFromPackage(sourceFile: SourceFile, name: string) {
  return Arr.some(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      ) ||
      REPOSITORY_SPECIFIER_PATTERN.test(statement.moduleSpecifier.text)
    ) {
      return false;
    }
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings !== undefined &&
      isNamedImports(bindings) &&
      Arr.some(bindings.elements, (element) => element.name.text === name)
    );
  });
}

/**
 * Whether the default export `satisfies` a configuration type that a framework
 * package defines, as the Confect source of `convex/auth.config.ts` does with
 * Convex's `AuthConfig`.
 */
function exportsFrameworkConfiguration(sourceFile: SourceFile) {
  return Arr.some(sourceFile.statements, (statement) => {
    if (
      !(
        isExportAssignment(statement) &&
        isSatisfiesExpression(statement.expression)
      )
    ) {
      return false;
    }
    const { type } = statement.expression;
    return (
      isTypeReferenceNode(type) &&
      isIdentifier(type.typeName) &&
      CONFIGURATION_TYPE_PATTERN.test(type.typeName.text) &&
      importsFromPackage(sourceFile, type.typeName.text)
    );
  });
}

/**
 * Whether a module configures a framework: by file name, through the Vitest
 * configuration API, or by a default export that satisfies a framework
 * package's configuration type.
 */
export function isConfiguration(file: string, sourceFile: SourceFile) {
  return (
    CONFIGURATION_FILE_PATTERN.test(file) ||
    imports(sourceFile, CONFIGURATION_MODULE_PATTERN) ||
    exportsFrameworkConfiguration(sourceFile)
  );
}

/**
 * Whether an import declaration loads at runtime: it is not `import type`, and it
 * does not name only types.
 */
export function loadsImport(node: ImportDeclaration) {
  const clause = node.importClause;
  const bindings = clause?.namedBindings;
  return !(
    clause?.phaseModifier === SyntaxKind.TypeKeyword ||
    (clause?.name === undefined &&
      bindings !== undefined &&
      isNamedImports(bindings) &&
      Arr.every(bindings.elements, ({ isTypeOnly }) => isTypeOnly))
  );
}

/**
 * Whether an export declaration loads at runtime: it is not `export type`, and it
 * does not name only types.
 */
export function loadsExport(node: ExportDeclaration) {
  const bindings = node.exportClause;
  return !(
    node.isTypeOnly ||
    (bindings !== undefined &&
      isNamedExports(bindings) &&
      Arr.every(bindings.elements, ({ isTypeOnly }) => isTypeOnly))
  );
}

/**
 * Whether a module loads, at runtime, a module whose specifier `pattern` matches,
 * through an import or a re-export. A type-only import or re-export does not
 * count, so a helper that imports only React types is not a React module.
 */
function loadsModule(sourceFile: SourceFile, pattern: RegExp) {
  return Arr.some(sourceFile.statements, (statement) => {
    if (isImportDeclaration(statement)) {
      return (
        loadsImport(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        pattern.test(statement.moduleSpecifier.text)
      );
    }
    return (
      isExportDeclaration(statement) &&
      loadsExport(statement) &&
      statement.moduleSpecifier !== undefined &&
      isStringLiteral(statement.moduleSpecifier) &&
      pattern.test(statement.moduleSpecifier.text)
    );
  });
}

/**
 * Whether a module opens with the `"use client"` directive, which is the first
 * statement of the module and a string literal.
 */
function isClientModule(sourceFile: SourceFile) {
  return Arr.some(
    Arr.take(sourceFile.statements, 1),
    (first) =>
      isExpressionStatement(first) &&
      isStringLiteral(first.expression) &&
      first.expression.text === CLIENT_DIRECTIVE
  );
}

/**
 * Whether a module renders or hooks into React, where timers belong to effects and
 * handlers. A client module's hooks throw during render so that the nearest error
 * boundary receives the error, and React offers no other channel for that.
 */
export function isReactModule(file: string, sourceFile: SourceFile) {
  return (
    JSX_PATTERN.test(file) ||
    loadsModule(sourceFile, REACT_PATTERN) ||
    isClientModule(sourceFile)
  );
}
