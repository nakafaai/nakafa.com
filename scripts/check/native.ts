import { Array as Arr, HashSet, String as Str } from "effect";
import {
  isBinaryExpression,
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isPropertyAccessExpression,
  isStringLiteralLikeNode,
  isTryStatement,
  isTypeOfExpression,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { loadsExport, loadsImport } from "#scripts/check/kinds";
import { candidate } from "#scripts/check/rules";
import { platformServerImports } from "#scripts/check/server";
import { detachedSpawnImports } from "#scripts/check/service";
import { ed25519SigningImports } from "#scripts/check/signing";
import { unwrapped } from "#scripts/check/wrapper";

/**
 * The Node modules whose job Effect or the platform does: files, paths, and
 * processes through Effect's services; digests and random bytes through
 * Effect's `Crypto`; keys, signatures, and HMACs through Web Crypto; bytes
 * through `Uint8Array` and `effect/encoding`; `.env` text through
 * `ConfigProvider`; ports and servers through `NodeSocketServer` and
 * `NodeHttpServer`; and the core count through `navigator.hardwareConcurrency`.
 * A module counts by its name alone, with or without the `node:` prefix and
 * with any subpath, such as `fs/promises`.
 */
const NODE_MODULES = HashSet.make(
  "buffer",
  "child_process",
  "crypto",
  "fs",
  "http",
  "net",
  "os",
  "path",
  "util"
);
const NODE_PREFIX_PATTERN = /^node:/u;
const EQUALITY_OPERATORS = HashSet.make(
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken
);

/** Whether a module specifier names a Node module that Effect or the platform replaces. */
function namesNodeModule(specifier: Node | undefined) {
  return (
    specifier !== undefined &&
    isStringLiteralLikeNode(specifier) &&
    HashSet.has(
      NODE_MODULES,
      Arr.headNonEmpty(
        Str.split(specifier.text.replace(NODE_PREFIX_PATTERN, ""), "/")
      )
    )
  );
}

/**
 * Whether a callee is a `createRequire(...)` call, which returns a `require`
 * function, such as `createRequire(import.meta.url)`.
 */
function isRequireFactory(callee: Node) {
  if (!isCallExpression(callee)) {
    return false;
  }
  const factory = unwrapped(callee.expression);
  return (
    (isIdentifier(factory) && factory.text === "createRequire") ||
    (isPropertyAccessExpression(factory) &&
      factory.name.text === "createRequire")
  );
}

/**
 * Whether a node loads a Node module that Effect or the platform replaces at
 * runtime: an import, an import assignment, a re-export, a dynamic import, or a call of
 * `require`, of a `createRequire` function, or of `getBuiltinModule`, each
 * with a literal module name. The callee of a call is unwrapped first, so
 * `(require)` and `(require as NodeRequire)` are the `require` function.
 */
function isNodeModuleLoad(node: Node) {
  if (isImportDeclaration(node)) {
    return loadsImport(node) && namesNodeModule(node.moduleSpecifier);
  }
  if (isImportEqualsDeclaration(node)) {
    return (
      !node.isTypeOnly &&
      isExternalModuleReference(node.moduleReference) &&
      namesNodeModule(node.moduleReference.expression)
    );
  }
  if (isExportDeclaration(node)) {
    return loadsExport(node) && namesNodeModule(node.moduleSpecifier);
  }
  if (!isCallExpression(node)) {
    return false;
  }
  const callee = unwrapped(node.expression);
  const loader =
    callee.kind === SyntaxKind.ImportKeyword ||
    (isIdentifier(callee) && callee.text === "require") ||
    (isPropertyAccessExpression(callee) &&
      callee.name.text === "getBuiltinModule") ||
    isRequireFactory(callee);
  const [specifier] = node.arguments;
  return loader && namesNodeModule(specifier);
}

/** Whether a node is the string `"object"`, the tag that `typeof` gives an object. */
function isObjectTag(node: Node) {
  return isStringLiteralLikeNode(node) && node.text === "object";
}

/**
 * Whether a node compares a typeof result against the object tag. A switch on a
 * typeof result is a switch statement, which the `switch` rule reports alone.
 * Parentheses and assertions around an operand do not change what it compares.
 */
function isTypeofObjectComparison(node: Node) {
  if (
    !(
      isBinaryExpression(node) &&
      HashSet.has(EQUALITY_OPERATORS, node.operatorToken.kind)
    )
  ) {
    return false;
  }
  const left = unwrapped(node.left);
  const right = unwrapped(node.right);
  return (
    (isTypeOfExpression(left) && isObjectTag(right)) ||
    (isTypeOfExpression(right) && isObjectTag(left))
  );
}

/** Returns the native module, failure, and narrowing syntax at one node. */
function syntaxCandidates(sourceFile: SourceFile, node: Node) {
  if (isNodeModuleLoad(node)) {
    return [candidate("node-module", sourceFile, node)];
  }
  if (isTryStatement(node) && node.catchClause !== undefined) {
    return [candidate("try-catch", sourceFile, node)];
  }
  return isTypeofObjectComparison(node)
    ? [candidate("typeof-object", sourceFile, node)]
    : [];
}

/**
 * Returns the native syntax among one module's value-position `nodes` that
 * Effect replaces: Node module imports, raw failure handling, and hand-rolled
 * narrowing. Promise syntax is judged by `promise.ts`, and array methods by the
 * typed pass in `arrays.ts`.
 * Three imports stay, each in a module of the shape its file sets out: a
 * detached process service keeps `spawn` (`service.ts`), a platform HTTP
 * server keeps `createServer` (`server.ts`), and a fixture that signs with
 * Ed25519 keeps `generateKeyPairSync` and `sign` (`signing.ts`).
 */
export function nativeCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const kept = Arr.flatten([
    detachedSpawnImports(sourceFile, nodes),
    platformServerImports(sourceFile, nodes),
    ed25519SigningImports(sourceFile, nodes),
  ]);
  return Arr.flatMap(nodes, (node) =>
    Arr.some(kept, (statement) => statement === node)
      ? []
      : syntaxCandidates(sourceFile, node)
  );
}
