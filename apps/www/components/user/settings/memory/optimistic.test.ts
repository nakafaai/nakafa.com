import { Ref } from "@confect/core";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Array as Arr, Equal, MutableRef, Option, Schema } from "effect";
import type { Memory } from "@/components/user/settings/memory/list";
import {
  addToList,
  clearList,
  editInList,
  pauseState,
  removeFromList,
} from "@/components/user/settings/memory/optimistic";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));

/** A stored memory written by Nina, with the fields a test changes spelled out. */
function stored(name: string, change: Partial<Memory> = {}): Memory {
  return {
    author: "nina",
    confirmedAt: 1000,
    createdAt: 500,
    id: memoryId(name),
    text: `Text of ${name}`,
    ...change,
  };
}

/**
 * One query the fake store holds: the name of its function, its encoded
 * arguments, and its encoded answer, which is none while the query loads.
 */
type Cached = readonly [name: string, args: unknown, value: unknown];

/**
 * A page of the list, held as Convex holds it: encoded by the function's own
 * schema. It has more after it unless it is the end of the list.
 */
function listed(
  cursor: string | null,
  memories: Memory[],
  isDone = false
): Cached {
  return [
    Ref.getConvexFunctionName(nina.memory.list),
    Ref.encodeArgsSync(nina.memory.list, {
      paginationOpts: { cursor, numItems: 30 },
    }),
    Ref.encodeReturnsSync(nina.memory.list, {
      continueCursor: "next",
      isDone,
      page: memories,
    }),
  ];
}

/** A page of the list that is still loading. */
function loading(cursor: string | null): Cached {
  return [
    Ref.getConvexFunctionName(nina.memory.list),
    Ref.encodeArgsSync(nina.memory.list, {
      paginationOpts: { cursor, numItems: 30 },
    }),
    undefined,
  ];
}

/** What the server says about the learner, or that it has nothing for a visitor. */
function stateOf(paused: boolean | null): Cached {
  return [
    Ref.getConvexFunctionName(nina.memory.state),
    Ref.encodeArgsSync(nina.memory.state, {}),
    Ref.encodeReturnsSync(
      nina.memory.state,
      paused === null ? null : { paused }
    ),
  ];
}

/**
 * A store with the queries the page has cached. It encodes and decodes with the
 * schemas of the functions, like Confect's own store over Convex's, and counts
 * the queries written, because a write wakes everything that reads the query.
 */
function fakeStore(initial: readonly Cached[]) {
  const cache = MutableRef.make(initial);
  const writes = MutableRef.make(0);
  const store: OptimisticLocalStore.OptimisticLocalStore = {
    getAllQueries: (ref) =>
      Arr.map(
        Arr.filter(
          MutableRef.get(cache),
          ([name]) => name === Ref.getConvexFunctionName(ref)
        ),
        ([, args, value]) => ({
          args: Ref.decodeArgsSync(ref, args),
          value:
            value === undefined
              ? Option.none()
              : Option.some(Ref.decodeReturnsSync(ref, value)),
        })
      ),
    // The page reads the state of the learner only, which has no arguments.
    getQuery: (ref, ..._arguments) =>
      Option.map(
        Arr.findFirst(
          MutableRef.get(cache),
          ([name, , value]) =>
            name === Ref.getConvexFunctionName(ref) && value !== undefined
        ),
        ([, , value]) => Ref.decodeReturnsSync(ref, value)
      ),
    setQuery: (ref, args, value) => {
      const name = Ref.getConvexFunctionName(ref);
      const encodedArgs = Ref.encodeArgsSync(ref, args);
      const next: Cached = [
        name,
        encodedArgs,
        Option.isSome(value)
          ? Ref.encodeReturnsSync(ref, value.value)
          : undefined,
      ];

      MutableRef.update(writes, (count) => count + 1);
      MutableRef.update(cache, (current) =>
        Arr.some(
          current,
          ([other, otherArgs]) =>
            other === name && Equal.equals(otherArgs, encodedArgs)
        )
          ? Arr.map(current, (entry) =>
              entry[0] === name && Equal.equals(entry[1], encodedArgs)
                ? next
                : entry
            )
          : Arr.append(current, next)
      );
    },
  };

  return { store, writes: () => MutableRef.get(writes) };
}

type Fake = ReturnType<typeof fakeStore>;

const ids = (memories: readonly Memory[]) => Arr.map(memories, ({ id }) => id);

/** The pages of the list the fake store holds, as the ids of their memories, or none while one loads. */
function pagesOf(fake: Fake) {
  return Arr.map(fake.store.getAllQueries(nina.memory.list), ({ value }) =>
    Option.match(value, {
      onNone: () => null,
      onSome: ({ page }) => ids(page),
    })
  );
}

/** The memories of the first page, as the store holds them. */
function firstPage(fake: Fake) {
  return Arr.flatMap(
    fake.store.getAllQueries(nina.memory.list),
    ({ args, value }) =>
      args.paginationOpts.cursor === null && Option.isSome(value)
        ? value.value.page
        : []
  );
}

describe("the optimistic changes of the memory page", () => {
  const newest = stored("newest");
  const older = stored("older");
  const oldest = stored("oldest", { confirmedAt: 100, text: "Kuiper belt" });
  const draft = { text: "Moved to Mondays", title: "Club" };

  describe("adding a memory", () => {
    it("shows it first on the page that starts the list and writes no other page", () => {
      const fake = fakeStore([listed(null, [newest]), listed("next", [older])]);
      const added = stored("added", { author: "learner" });

      addToList(fake.store, added);

      expect(pagesOf(fake)).toEqual([[added.id, newest.id], [older.id]]);
      expect(fake.writes()).toBe(1);
    });

    it("leaves a page that is still loading, the first one included", () => {
      const fake = fakeStore([listed(null, [newest]), loading("next")]);
      const loadingFirst = fakeStore([loading(null)]);

      addToList(fake.store, stored("added"));
      addToList(loadingFirst.store, stored("added"));

      expect(pagesOf(fake)).toEqual([[memoryId("added"), newest.id], null]);
      expect(fake.writes()).toBe(1);
      expect(pagesOf(loadingFirst)).toEqual([null]);
      expect(loadingFirst.writes()).toBe(0);
    });
  });

  describe("rewriting a memory", () => {
    it("takes it off its page and puts it first on the page that starts the list", () => {
      const fake = fakeStore([
        listed(null, [newest]),
        listed("next", [older, oldest]),
      ]);

      editInList(fake.store, oldest.id, draft, 5000);

      expect(pagesOf(fake)).toEqual([[oldest.id, newest.id], [older.id]]);
      expect(firstPage(fake)[0]).toEqual({
        author: "learner",
        confirmedAt: 5000,
        createdAt: 500,
        id: oldest.id,
        text: "Moved to Mondays",
        title: "Club",
      });
    });

    it("takes the title off a memory rewritten without one", () => {
      const titled = stored("titled", { title: "Old title" });
      const fake = fakeStore([listed(null, [titled])]);

      editInList(fake.store, titled.id, { text: "Words", title: "" }, 5000);

      expect(firstPage(fake)[0]).not.toHaveProperty("title");
    });

    it("leaves a memory the page does not hold to the server", () => {
      const fake = fakeStore([listed(null, [newest]), loading("next")]);

      editInList(fake.store, memoryId("far"), draft, 5000);

      expect(fake.writes()).toBe(0);
      expect(pagesOf(fake)).toEqual([[newest.id], null]);
    });
  });

  describe("deleting a memory", () => {
    it("takes it off every page that holds it", () => {
      const fake = fakeStore([
        listed(null, [newest, older]),
        listed("next", [oldest]),
        loading("later"),
      ]);

      removeFromList(fake.store, older.id);

      expect(pagesOf(fake)).toEqual([[newest.id], [oldest.id], null]);
    });

    it("writes no page that does not hold the memory", () => {
      const fake = fakeStore([listed(null, [newest]), loading("next")]);

      removeFromList(fake.store, older.id);

      expect(fake.writes()).toBe(0);
    });
  });

  describe("deleting every memory", () => {
    it("empties every page that holds memories and ends the list on each", () => {
      const fake = fakeStore([
        listed(null, [newest, older]),
        listed("next", [oldest]),
        loading("later"),
      ]);

      clearList(fake.store);

      expect(pagesOf(fake)).toEqual([[], [], null]);
      expect(
        Arr.map(fake.store.getAllQueries(nina.memory.list), ({ value }) =>
          Option.exists(value, (page) => page.isDone)
        )
      ).toEqual([true, true, false]);
      expect(fake.writes()).toBe(2);
    });

    it("writes no page that is already empty and done", () => {
      const fake = fakeStore([listed(null, [newest])]);

      clearList(fake.store);
      clearList(fake.store);

      expect(fake.writes()).toBe(1);
    });
  });

  describe("pausing memory", () => {
    it("sets whether memory is paused where the page holds the state", () => {
      const fake = fakeStore([stateOf(false)]);

      pauseState(fake.store, true);

      expect(fake.store.getQuery(nina.memory.state, {})).toEqual(
        Option.some({ paused: true })
      );
    });

    it("sets nothing where the page has no state or the server gave none", () => {
      const missing = fakeStore([]);
      const visitor = fakeStore([stateOf(null)]);

      pauseState(missing.store, true);
      pauseState(visitor.store, true);

      expect(missing.writes()).toBe(0);
      expect(visitor.writes()).toBe(0);
    });
  });
});
