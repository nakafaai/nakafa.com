import { Array as Arr, HashSet, Option } from "effect";
import {
  type CallExpression,
  isCallExpression,
  isStringLiteral,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { importedName, namedImports, readsOf } from "#scripts/check/imports";

/** The Node crypto module, by both of its specifiers. */
const CRYPTO_MODULES = HashSet.make("crypto", "node:crypto");
/** The functions of the crypto module that make and use an asymmetric key pair synchronously. */
const KEY_PAIR = "generateKeyPairSync";
const SIGN = "sign";
const SIGNING_FUNCTIONS = HashSet.make(KEY_PAIR, SIGN);
/** The key type whose key pair and signature the construction allows. */
const ED25519 = "ed25519";

/** Whether a call passes `ed25519` as the type of key pair it makes, which is its first argument. */
function makesEd25519(call: CallExpression) {
  return Option.exists(
    Arr.head(call.arguments),
    (first) => isStringLiteral(first) && first.text === ED25519
  );
}

/** Whether a call passes `null` as the digest it signs with, which is its first argument. Ed25519 signs the message itself. */
function signsWithoutDigest(call: CallExpression) {
  return Option.exists(
    Arr.head(call.arguments),
    (first) => first.kind === SyntaxKind.NullKeyword
  );
}

/**
 * Whether a read of a signing function is a call of it with the argument that
 * the construction allows. A read that is the argument of another call, the
 * object of a method such as `sign.call`, an alias, or a re-export is not.
 */
function isAllowedCall(use: Node, imported: string) {
  const call = use.parent;
  return (
    isCallExpression(call) &&
    call.expression === use &&
    (imported === KEY_PAIR ? makesEd25519(call) : signsWithoutDigest(call))
  );
}

/**
 * Returns the import declarations of the Node crypto module that a fixture
 * keeps to sign synchronously with Ed25519. Neither Effect's `Signature` nor Web
 * Crypto signs synchronously, and a fixture built when its module loads cannot
 * wait for a Promise. All of these hold:
 * - The import declaration binds `generateKeyPairSync` and `sign`, under any
 *   local names, and nothing else at run time.
 * - Every read of the first is a call that makes an `ed25519` key pair, and
 *   every read of the second is a call that passes `null` as its digest, which
 *   is how Node signs with Ed25519. An alias, a method such as `sign.call`, and
 *   a handover to another function are reads that no such call makes, so they
 *   keep no import.
 * - The module has at least one such call.
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
        HashSet.has(SIGNING_FUNCTIONS, importedName(element))
      )
        ? [{ bound, statement }]
        : [];
    }
  );
  const reads = Arr.flatMap(imports, ({ bound }) =>
    Arr.flatMap(bound, (element) =>
      Arr.map(readsOf(nodes, element.name.text), (use) =>
        isAllowedCall(use, importedName(element))
      )
    )
  );
  return Arr.isReadonlyArrayNonEmpty(reads) &&
    Arr.every(reads, (allowed) => allowed)
    ? Arr.map(imports, ({ statement }) => statement)
    : [];
}
