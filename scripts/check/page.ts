import { Array as Arr, HashSet, Result } from "effect";
import {
  isArrowFunction,
  isCallExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isPropertyAccessExpression,
  isSourceFile,
  isStringLiteral,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { imports } from "#scripts/check/rules";

const PLAYWRIGHT_PATTERN = /^@playwright\/test$/u;
const MODULE_EXTENSION_PATTERN = /\.[cm]?tsx?$/u;
/** Playwright methods that serialize a function and run it in the browser page. */
const PAGE_METHODS = HashSet.make(
  "$$eval",
  "$eval",
  "addInitScript",
  "evaluate",
  "evaluateAll",
  "evaluateHandle",
  "waitForFunction"
);

/**
 * Returns the function a Playwright call serializes into the browser page: the
 * first argument of `evaluate` and its siblings, the second of `$eval` and
 * `$$eval`.
 */
function pageArgument(node: Node) {
  if (
    !(
      isCallExpression(node) &&
      isPropertyAccessExpression(node.expression) &&
      HashSet.has(PAGE_METHODS, node.expression.name.text)
    )
  ) {
    return;
  }
  return node.arguments[node.expression.name.text.startsWith("$") ? 1 : 0];
}

/** Names one function by the module that declares it, such as `apps/www/e2e/support/canvas#patchWebGL`. */
function functionKey(module: string, name: string) {
  return `${module}#${name}`;
}

/** Returns a module's path without its extension, the form an import specifier resolves to. */
function moduleKey(file: string) {
  return file.replace(MODULE_EXTENSION_PATTERN, "");
}

/** Joins path segments, resolving `.` and `..`. */
function joinSegments(segments: readonly string[]) {
  return Arr.join(
    Arr.reduce(segments, Arr.empty<string>(), (path, segment) => {
      if (segment === "." || segment === "") {
        return path;
      }
      return segment === ".."
        ? Arr.dropRight(path, 1)
        : Arr.append(path, segment);
    }),
    "/"
  );
}

/**
 * Resolves a repository import specifier from `file` to a module key: the app
 * alias `@/` from the app's root (its first two path segments), and a relative
 * path from the file's folder.
 * A package specifier names no repository module.
 */
function resolveSpecifier(file: string, specifier: string) {
  if (specifier.startsWith("@/")) {
    return Result.succeed(
      joinSegments([...Arr.take(file.split("/"), 2), specifier.slice(2)])
    );
  }
  return specifier.startsWith(".")
    ? Result.succeed(
        joinSegments([
          ...Arr.dropRight(file.split("/"), 1),
          ...specifier.split("/"),
        ])
      )
    : Result.failVoid;
}

/**
 * Returns the function a local name stands for: the module that declares it
 * and its declared name. A named import resolves to the exporting module and
 * the exported name, so an aliased import still names the original function.
 */
function declaredFunction(file: string, sourceFile: SourceFile, local: string) {
  for (const statement of sourceFile.statements) {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      )
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !isNamedImports(bindings)) {
      continue;
    }
    const element = Arr.findFirst(
      bindings.elements,
      (candidate) => candidate.name.text === local
    );
    if (element._tag === "Some") {
      const name = element.value.propertyName?.text ?? local;
      return Result.map(
        resolveSpecifier(file, statement.moduleSpecifier.text),
        (module) => functionKey(module, name)
      );
    }
  }
  return Result.succeed(functionKey(moduleKey(file), local));
}

/**
 * Returns the functions a Playwright module passes to the browser page by
 * reference, such as `patchWebGL` in `page.addInitScript(patchWebGL, ...)`,
 * each named by the module that declares it.
 */
export function pageFunctionKeys(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return imports(sourceFile, PLAYWRIGHT_PATTERN)
    ? Arr.filterMap(nodes, (node) => {
        const argument = pageArgument(node);
        return argument !== undefined && isIdentifier(argument)
          ? declaredFunction(file, sourceFile, argument.text)
          : Result.failVoid;
      })
    : [];
}

/**
 * Whether a node is a function that runs in the browser page: one written in
 * a Playwright call of a Playwright module, or one this module declares under
 * a name that satisfies `passed`.
 */
function isPageFunction(
  node: Node,
  inline: boolean,
  passed: (name: string) => boolean
) {
  if (isFunctionDeclaration(node)) {
    return node.name !== undefined && passed(node.name.text);
  }
  if (!(isArrowFunction(node) || isFunctionExpression(node))) {
    return false;
  }
  const { parent } = node;
  if (isVariableDeclaration(parent)) {
    return isIdentifier(parent.name) && passed(parent.name.text);
  }
  return inline && pageArgument(parent) === node;
}

/** Whether a node sits inside a function that runs in the browser page. */
function runsInPage(
  node: Node,
  inline: boolean,
  passed: (name: string) => boolean
): boolean {
  if (isSourceFile(node)) {
    return false;
  }
  return (
    isPageFunction(node, inline, passed) ||
    runsInPage(node.parent, inline, passed)
  );
}

/**
 * Returns the nodes of a module that run where its imports exist. A function
 * that Playwright serializes into the browser page runs without any import,
 * so Effect cannot replace a platform global or derive a shape inside it. That
 * covers a function written in a `page.evaluate`, `addInitScript`, or sibling
 * call of a Playwright module, and a function this module declares that some
 * Playwright module passes to such a call by reference (`keys`, from
 * `pageFunctionKeys`).
 */
export function outsidePage(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[],
  keys: HashSet.HashSet<string>
) {
  const inline = imports(sourceFile, PLAYWRIGHT_PATTERN);
  const module = moduleKey(file);
  const passed = (name: string) => HashSet.has(keys, functionKey(module, name));
  return Arr.filter(nodes, (node) => !runsInPage(node, inline, passed));
}
