import { Array as Arr, Effect } from "effect";
import type { Node } from "typescript/unstable/ast";
import type { Checker, Type } from "typescript/unstable/sync";
import { TestCompilerError } from "#scripts/check/source";

/** The intrinsic names of `undefined` and `null`, which a receiver may hold beside its array. */
const NULLISH_NAMES = ["null", "undefined"];

/** Describes a native compiler question that failed while the receivers were judged. */
const compilerFailure = (cause: unknown) =>
  new TestCompilerError({ cause, message: "Unable to read repository types." });

/** Asks the native compiler one question, failing with a typed error when it throws. */
const ask = <A>(question: () => A) =>
  Effect.try({ try: question, catch: compilerFailure });

/** Whether a type is one of the intrinsic types with one of the given names. */
function intrinsicNamed(type: Type, names: readonly string[]) {
  return type.isIntrinsicType() && Arr.contains(names, type.intrinsicName);
}

/** Whether a type is `any`, or the error type that stands for a type the compiler cannot determine. */
function isAnyType(type: Type) {
  return type.isErrorType() || intrinsicNamed(type, ["any"]);
}

/**
 * Whether a receiver's type makes its call an array method call. A type that
 * the compiler cannot give, and `any`, count as arrays, so an untyped value gets
 * no pass. A union is an array when every member other than `undefined` and
 * `null` is one, an intersection when one member is, and a type parameter when
 * its base constraint is. An unconstrained type parameter is not an array. Any
 * other type is an array when the compiler finds it assignable to a readonly
 * array, which admits a subtype of Array or ReadonlyArray and refuses a string,
 * a typed array, or a Set.
 */
const isArrayReceiver = Effect.fnUntraced(function* (
  checker: Checker,
  type: Type | undefined
): Effect.fn.Return<boolean, TestCompilerError> {
  if (type === undefined || isAnyType(type)) {
    return true;
  }
  if (intrinsicNamed(type, ["never"])) {
    return false;
  }
  if (type.isUnionType()) {
    const members = yield* ask(() => type.getTypes());
    const named = Arr.filter(
      members,
      (member) => !intrinsicNamed(member, NULLISH_NAMES)
    );
    if (Arr.isReadonlyArrayEmpty(named)) {
      return false;
    }
    const verdicts = yield* Effect.forEach(named, (member) =>
      isArrayReceiver(checker, member)
    );
    return Arr.every(verdicts, (verdict) => verdict);
  }
  if (type.isIntersectionType()) {
    const members = yield* ask(() => type.getTypes());
    const verdicts = yield* Effect.forEach(members, (member) =>
      isArrayReceiver(checker, member)
    );
    return Arr.some(verdicts, (verdict) => verdict);
  }
  if (type.isTypeParameter()) {
    const constraint = yield* ask(() => checker.getBaseConstraintOfType(type));
    return (
      constraint !== undefined && (yield* isArrayReceiver(checker, constraint))
    );
  }
  return yield* ask(() => checker.isArrayLikeType(type));
});

/**
 * Returns, for each receiver expression in order, whether the compiler types it
 * as an array. The types of every receiver of a module come in one request.
 */
export const receiverVerdicts = Effect.fn("RepositoryPolicy.receiverVerdicts")(
  function* (checker: Checker, receivers: readonly Node[]) {
    const types = yield* ask(() => checker.getTypeAtLocation(receivers));
    return yield* Effect.forEach(types, (type) =>
      isArrayReceiver(checker, type)
    );
  }
);
