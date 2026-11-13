import { Array as Arr, HashMap, Option, Result, String as Str } from "effect";
import {
  isArrowFunction,
  isBlock,
  isCallExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isMethodDeclaration,
  isNamedImports,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isReturnStatement,
  isStringLiteral,
  isVariableStatement,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { judgesMarkup } from "#scripts/check/jsx";
import { children } from "#scripts/check/source";

/** A parsed module, by its repository path. */
interface Module {
  readonly file: string;
  readonly sourceFile: SourceFile;
}

/** A component that a module declares at its top level, with the function that renders it. */
export interface Component extends Module {
  readonly body: Node;
  readonly name: string;
}

/** The place of a component, which names it once in the repository: its module and its name. */
export function componentKey({ file, name }: Pick<Component, "file" | "name">) {
  return `${file}#${name}`;
}

/** A component's name starts with a capital letter, as React requires of an element's tag. */
const COMPONENT_NAME_PATTERN = /^[A-Z]/u;
/** An app imports its own modules from `@/`, and a package's modules from `@repo/<package>/`. */
const APP_PATTERN = /^(?<app>apps\/[^/]+)\//u;
const APP_ALIAS = "@/";
const PACKAGE_ALIAS_PATTERN = /^@repo\/(?<rest>.+)$/u;
const MODULE_EXTENSIONS = [".tsx", ".ts"];

/** The components a module declares: functions, and variables that hold an arrow or a function expression. */
function declared(module: Module) {
  return Arr.flatMap(
    module.sourceFile.statements,
    (statement): readonly Component[] => {
      if (isFunctionDeclaration(statement) && statement.name !== undefined) {
        return [{ ...module, body: statement, name: statement.name.text }];
      }
      return isVariableStatement(statement)
        ? Arr.filterMap(
            statement.declarationList.declarations,
            (declaration) =>
              isIdentifier(declaration.name) &&
              declaration.initializer !== undefined &&
              (isArrowFunction(declaration.initializer) ||
                isFunctionExpression(declaration.initializer))
                ? Result.succeed({
                    ...module,
                    body: declaration.initializer,
                    name: declaration.name.text,
                  })
                : Result.failVoid
          )
        : [];
    }
  );
}

/** A path with its `.` and `..` segments resolved, such as `a/c` for `a/b/../c`. */
function normalized(path: string) {
  return Arr.join(
    Arr.reduce(Str.split(path, "/"), Arr.empty<string>(), (kept, segment) => {
      if (segment === "..") {
        return Arr.dropRight(kept, 1);
      }
      return segment === "." || segment === ""
        ? kept
        : Arr.append(kept, segment);
    }),
    "/"
  );
}

/** The repository path, without its extension, that a specifier names from one module, or none for a package. */
function target(file: string, specifier: string) {
  if (specifier.startsWith(".")) {
    return Option.some(
      normalized(
        `${Arr.join(Arr.dropRight(Str.split(file, "/"), 1), "/")}/${specifier}`
      )
    );
  }
  if (specifier.startsWith(APP_ALIAS)) {
    return Option.map(
      Option.fromNullishOr(APP_PATTERN.exec(file)?.groups?.app),
      (app) => `${app}/src/${specifier.slice(APP_ALIAS.length)}`
    );
  }
  return Option.map(
    Option.fromNullishOr(PACKAGE_ALIAS_PATTERN.exec(specifier)?.groups?.rest),
    (rest) => `packages/${rest}`
  );
}

/** The module and the exported name that each name a module imports by name stands for. */
function importedNames(module: Module) {
  return Arr.flatMap(module.sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      )
    ) {
      return [];
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !isNamedImports(bindings)) {
      return [];
    }
    const path = target(module.file, statement.moduleSpecifier.text);
    return Option.match(path, {
      onNone: () => [],
      onSome: (resolved) =>
        Arr.map(bindings.elements, (element) => ({
          exported: (element.propertyName ?? element.name).text,
          local: element.name.text,
          path: resolved,
        })),
    });
  });
}

/** Whether a node calls `import(...)` with the specifier as written, such as `import("@/components/x")`. */
function importedSpecifier(node: Node) {
  return isCallExpression(node) &&
    node.expression.kind === SyntaxKind.ImportKeyword &&
    node.arguments[0] !== undefined &&
    isStringLiteral(node.arguments[0])
    ? Option.some(node.arguments[0].text)
    : Option.none();
}

/**
 * The components a module loads on demand, as `const X = lazy(() => import("...").then((module) => ({ default:
 * module.Y })))`: X stands for the component Y of that module.
 */
function lazyNames(module: Module) {
  return Arr.flatMap(module.sourceFile.statements, (statement) =>
    isVariableStatement(statement)
      ? Arr.flatMap(statement.declarationList.declarations, (declaration) => {
          const { initializer, name } = declaration;
          if (initializer === undefined || !isIdentifier(name)) {
            return [];
          }
          const below = nodesBelow(initializer);
          const loaded = Option.flatMap(
            Arr.findFirst(below, importedSpecifier),
            (specifier) => target(module.file, specifier)
          );
          const exported = Arr.findFirst(below, (node) =>
            isPropertyAccessExpression(node) &&
            COMPONENT_NAME_PATTERN.test(node.name.text)
              ? Option.some(node.name.text)
              : Option.none()
          );
          return Option.match(Option.all({ exported, loaded }), {
            onNone: () => [],
            onSome: ({ exported: found, loaded: path }) => [
              { exported: found, local: name.text, path },
            ],
          });
        })
      : []
  );
}

/** What a function returns, its own returns only: a function written inside it returns for itself. */
function returnsOf(node: Node): readonly Node[] {
  return Arr.flatMap(children(node), (child) => {
    if (
      isArrowFunction(child) ||
      isFunctionExpression(child) ||
      isFunctionDeclaration(child) ||
      isMethodDeclaration(child)
    ) {
      return [];
    }
    if (isReturnStatement(child)) {
      return child.expression === undefined ? [] : [child.expression];
    }
    return returnsOf(child);
  });
}

/** The elements a component renders at its root: what it returns, out of parentheses, `null` left out. */
export function rootsOf(component: Component) {
  const { body } = component;
  const returned =
    (isArrowFunction(body) ||
      isFunctionExpression(body) ||
      isFunctionDeclaration(body)) &&
    body.body !== undefined &&
    !isBlock(body.body)
      ? [body.body]
      : returnsOf(body);
  return Arr.filter(
    Arr.map(returned, (node) =>
      isParenthesizedExpression(node) ? node.expression : node
    ),
    (node) => node.kind !== SyntaxKind.NullKeyword
  );
}

/**
 * The components of the judged modules, and the one a tag names in a module: the module's own component of that name,
 * or the component it imports under that name from another judged module.
 */
export function componentGraph(modules: readonly Module[]) {
  const judged = Arr.filter(modules, ({ file }) => judgesMarkup(file));
  const components = Arr.filter(Arr.flatMap(judged, declared), ({ name }) =>
    COMPONENT_NAME_PATTERN.test(name)
  );
  const byPlace = HashMap.fromIterable(
    Arr.map(
      components,
      (component) => [componentKey(component), component] as const
    )
  );
  const imports = HashMap.fromIterable(
    Arr.map(
      judged,
      (module) =>
        [
          module.file,
          Arr.appendAll(importedNames(module), lazyNames(module)),
        ] as const
    )
  );
  const resolve = (file: string, tag: string) =>
    Option.orElse(HashMap.get(byPlace, componentKey({ file, name: tag })), () =>
      Option.flatMap(
        Option.flatMap(HashMap.get(imports, file), (names) =>
          Arr.findFirst(names, ({ local }) => local === tag)
        ),
        ({ exported, path }) =>
          Arr.findFirst(MODULE_EXTENSIONS, (extension) =>
            HashMap.get(
              byPlace,
              componentKey({ file: `${path}${extension}`, name: exported })
            )
          )
      )
    );
  return { components, resolve };
}
