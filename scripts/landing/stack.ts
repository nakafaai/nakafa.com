import { Array as Arr, Option, Order, Record as Rec, Schema } from "effect";

/** An open pull request as the train reads it, with the branch it targets. */
export const Pull = Schema.Struct({
  number: Schema.Int,
  headRefOid: Schema.String,
  headRefName: Schema.String,
  baseRefName: Schema.String,
  title: Schema.String,
  isDraft: Schema.Boolean,
  files: Schema.Array(Schema.Struct({ path: Schema.String })),
});
export type Pull = typeof Pull.Type;

/**
 * The stacks of the open pull requests, each bottom-up: a pull request on main,
 * then each one that targets the branch of the one before. A lone pull request
 * on main is a stack of one. One that targets a branch no open pull request in
 * the list holds belongs to no stack, because it cannot land on main.
 */
export function stacksOf(
  pulls: readonly Pull[]
): readonly Arr.NonEmptyReadonlyArray<Pull>[] {
  const above = Arr.groupBy(pulls, (pull) => pull.baseRefName);
  const climb = (
    stack: Arr.NonEmptyReadonlyArray<Pull>
  ): readonly Arr.NonEmptyReadonlyArray<Pull>[] =>
    Option.match(Rec.get(above, Arr.lastNonEmpty(stack).headRefName), {
      onNone: () => [stack],
      onSome: (children) =>
        Arr.flatMap(children, (child) => climb(Arr.append(stack, child))),
    });
  // The oldest stack first, so the train lands pull requests in the order they came.
  return Arr.flatMap(
    Arr.sort(
      Arr.filter(pulls, (pull) => pull.baseRefName === "main"),
      Order.mapInput(Order.Number, (pull: Pull) => pull.number)
    ),
    (bottom: Pull) => climb([bottom])
  );
}

/**
 * The highest member of a stack whose own head passed its gate and proof, and
 * the members below it, bottom-up. That head's proof ran on every change below
 * it that it contains, so it may carry them.
 */
export function highestProven(
  stack: Arr.NonEmptyReadonlyArray<Pull>,
  proven: (pull: Pull) => boolean
) {
  return Option.flatMap(Arr.findLastIndex(stack, proven), (index) =>
    Option.map(Arr.get(stack, index), (top) => ({
      top,
      below: Arr.take(stack, index),
    }))
  );
}

/**
 * A pull request that rides a train, with its depth in its stack (0 for the one
 * on main) and its stack, named by the number of the pull request at its bottom.
 */
export const Rider = Schema.Struct({
  pull: Pull,
  depth: Schema.Int,
  stack: Schema.Int,
});
export type Rider = typeof Rider.Type;

/**
 * The riders in the order they land: a base before what is built on it, then
 * by number, each pull request once.
 */
export function landingOrder(riders: readonly Rider[]): readonly Rider[] {
  return Arr.dedupeWith(
    Arr.sort(
      riders,
      Order.combine(
        Order.mapInput(Order.Number, (rider: Rider) => rider.depth),
        Order.mapInput(Order.Number, (rider: Rider) => rider.pull.number)
      )
    ),
    (one, other) => one.pull.number === other.pull.number
  );
}

/** The members of a stack as riders, bottom-up. */
export const ridersOf = (stack: Arr.NonEmptyReadonlyArray<Pull>) =>
  Arr.map(stack, (pull, depth) => ({
    pull,
    depth,
    stack: Arr.headNonEmpty(stack).number,
  }));
