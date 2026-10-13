import { Array as Arr, HashSet, Option } from "effect";
import {
  isCallExpression,
  isIdentifier,
  isStringLiteral,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { namedImports } from "#scripts/check/imports";

/** The Node crypto module, by both of its specifiers. */
const CRYPTO_MODULES = HashSet.make("crypto", "node:crypto");
/** The functions of the crypto module that make and use an asymmetric key pair synchronously. */
const KEY_PAIR = "generateKeyPairSync";
const SIGN = "sign";
const SIGNING_FUNCTIONS = HashSet.make(KEY_PAIR, SIGN);
/** The key type whose key pair and signature the construction allows. */
const ED25519 = "ed25519";

/** Returns the calls of a function by the local name the module gives it. */
function callsOf(nodes: readonly Node[], name: string) {
  return Arr.filter(
    nodes,
    (node) =>
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === name
  );
}

/** Whether a call passes `ed25519` as the type of key pair it makes, which is its first argument. */
function makesEd25519(call: Node) {
  return (
    isCallExpression(call) &&
    Option.exists(
      Arr.head(call.arguments),
      (first) => isStringLiteral(first) && first.text === ED25519
    )
  );
}

/** Whether a call passes `null` as the digest it signs with, which is its first argument. Ed25519 signs the message itself. */
function signsWithoutDigest(call: Node) {
  return (
    isCallExpression(call) &&
    Option.exists(
      Arr.head(call.arguments),
      (first) => first.kind === SyntaxKind.NullKeyword
    )
  );
}

/**
 * Returns the import declarations of the Node crypto module that a fixture
 * keeps to sign synchronously with Ed25519. Neither Effect's `Crypto` nor Web
 * Crypto signs synchronously, and a fixture built when its module loads cannot
 * wait for a Promise. All of these hold:
 * - The import declaration binds `generateKeyPairSync` and `sign`, under any
 *   local names, and nothing else at run time.
 * - Every call of the first makes an `ed25519` key pair, and every call of the
 *   second passes `null` as its digest, which is how Node signs with Ed25519.
 * - The module makes at least one such call.
 * Any other load of the crypto module is still reported, so hashes, HMACs,
 * random bytes, and other key types go to Effect and Web Crypto.
 */
export function ed25519SigningImports(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const imports = Arr.flatMap(
    namedImports(sourceFile, (specifier) =>
      HashSet.has(CRYPTO_MODULES, specifier)
    ),
    ([statement, elements]) => {
      const bound = Arr.filter(elements, (element) => !element.isTypeOnly);
      return Arr.every(bound, (element) =>
        HashSet.has(
          SIGNING_FUNCTIONS,
          (element.propertyName ?? element.name).text
        )
      )
        ? [{ bound, statement }]
        : [];
    }
  );
  const calls = Arr.flatMap(imports, ({ bound }) =>
    Arr.flatMap(bound, (element) =>
      Arr.map(callsOf(nodes, element.name.text), (call) =>
        (element.propertyName ?? element.name).text === KEY_PAIR
          ? makesEd25519(call)
          : signsWithoutDigest(call)
      )
    )
  );
  return Arr.isReadonlyArrayNonEmpty(calls) &&
    Arr.every(calls, (allowed) => allowed)
    ? Arr.map(imports, ({ statement }) => statement)
    : [];
}
