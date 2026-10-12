import { Ref } from "@confect/core";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, MutableHashMap, MutableList, Option } from "effect";

/**
 * One saved query result: its function, its encoded arguments and its encoded
 * value, which is missing while the query loads.
 */
type Row = readonly [name: string, args: unknown, value: unknown];

/** The key one subscription is saved under. */
function keyOf(ref: Ref.Any, encodedArgs: unknown) {
  return `${Ref.getConvexFunctionName(ref)}:${encodeJsonText(encodedArgs)}`;
}

/** A saved value as its query returns it, or nothing while the query loads. */
function readValue<Query extends Ref.AnyPublicQuery>(
  ref: Query,
  value: unknown
) {
  return value === undefined
    ? Option.none()
    : Option.some(Ref.decodeReturnsSync(ref, value));
}

/**
 * A local store that behaves like Convex's: it hands out the saved query
 * results, an update writes new ones with `setQuery`, and each write is
 * recorded. Values pass through the real Confect codecs, so a value an update
 * writes must satisfy the query's own schema.
 */
export function createLocalStore() {
  const rows = MutableHashMap.empty<string, Row>();
  const written = MutableList.make<string>();

  const store: OptimisticLocalStore.OptimisticLocalStore = {
    getAllQueries: (ref) =>
      Arr.flatMap(
        Arr.fromIterable(MutableHashMap.values(rows)),
        ([name, args, value]) =>
          name === Ref.getConvexFunctionName(ref)
            ? [
                {
                  args: Ref.decodeArgsSync(ref, args),
                  value: readValue(ref, value),
                },
              ]
            : []
      ),
    getQuery: (ref, ...rest) =>
      Option.flatMap(Option.fromUndefinedOr(rest[0]), (args) =>
        Option.flatMap(
          MutableHashMap.get(rows, keyOf(ref, Ref.encodeArgsSync(ref, args))),
          ([, , value]) => readValue(ref, value)
        )
      ),
    setQuery: (ref, args, value) => {
      const encodedArgs = Ref.encodeArgsSync(ref, args);
      const key = keyOf(ref, encodedArgs);
      MutableList.append(written, key);
      MutableHashMap.set(rows, key, [
        Ref.getConvexFunctionName(ref),
        encodedArgs,
        Ref.encodeReturnsSync(ref, Option.getOrThrow(value)),
      ]);
    },
  };

  return {
    /** Saves a query result as the server sent it; `undefined` is a query still loading. */
    seed: <Query extends Ref.AnyPublicQuery>(
      ref: Query,
      args: Ref.Args<Query>,
      value: Ref.Returns<Query> | undefined
    ) => {
      const encodedArgs = Ref.encodeArgsSync(ref, args);
      MutableHashMap.set(rows, keyOf(ref, encodedArgs), [
        Ref.getConvexFunctionName(ref),
        encodedArgs,
        value === undefined ? undefined : Ref.encodeReturnsSync(ref, value),
      ]);
    },
    store,
    /** The key of every subscription an update has written, in order. */
    written: () => MutableList.toArray(written),
  };
}
