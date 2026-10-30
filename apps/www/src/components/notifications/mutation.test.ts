import { Ref } from "@confect/core";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { NotificationView } from "@repo/backend/confect/notifications/schema";
import { Array as Arr, Equal, MutableRef, Option, Schema } from "effect";
import {
  markAllReadInLists,
  markReadInLists,
} from "@/components/notifications/mutation";
import type { ListNotification } from "@/components/notifications/state";

const notificationId = Schema.decodeUnknownSync(Id("notifications"));

/** An inbox row as the server sends it, read at `readAt` when the row names one. */
function row(id: string, readAt?: number): ListNotification {
  return Schema.decodeUnknownSync(NotificationView)({
    changeType: "person.invited",
    detail: null,
    createdAt: 1,
    id,
    subject: { id: "person-1", kind: "person" },
    tenant: {
      kind: "school",
      mascot: "cat.0.243e66.right.open",
      name: "Harapan",
      slug: "harapan",
      status: "active",
    },
    ...(readAt === undefined ? {} : { readAt }),
  });
}

/**
 * One query the fake store holds: the name of its function, its encoded
 * arguments, and its encoded answer, which is none while the query loads.
 */
type Cached = readonly [name: string, args: unknown, value: unknown];

/**
 * The fake store keys each page by its cursor, so its page size is any number
 * that the arguments of the list take.
 */
const FAKE_NUM_ITEMS = 1;

/** A page of the inbox, held as Convex holds it. */
function listed(
  cursor: string | null,
  page: ListNotification[],
  isDone = false
): Cached {
  return [
    Ref.getConvexFunctionName(notifications.inbox.list),
    Ref.encodeArgsSync(notifications.inbox.list, {
      paginationOpts: { cursor, numItems: FAKE_NUM_ITEMS },
    }),
    Ref.encodeReturnsSync(notifications.inbox.list, {
      continueCursor: "next",
      isDone,
      page,
    }),
  ];
}

/** A page of the inbox that is still loading. */
function loading(cursor: string | null): Cached {
  return [
    Ref.getConvexFunctionName(notifications.inbox.list),
    Ref.encodeArgsSync(notifications.inbox.list, {
      paginationOpts: { cursor, numItems: FAKE_NUM_ITEMS },
    }),
    undefined,
  ];
}

/**
 * A store with the lists the page has cached. It encodes and decodes with the
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
    // The changes read the lists through `getAllQueries`, never one query.
    getQuery: () => Option.none(),
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

/** The pages the fake store holds, as the read time of each row, or none while one loads. */
function readTimesOf(fake: Fake) {
  return Arr.map(
    fake.store.getAllQueries(notifications.inbox.list),
    ({ value }) =>
      Option.match(value, {
        onNone: () => null,
        onSome: ({ page }) => Arr.map(page, ({ readAt }) => readAt),
      })
  );
}

describe("the optimistic changes of the inbox list", () => {
  it("marks one row read on every loaded page that holds it, and leaves a loading list alone", () => {
    const first = row("first");
    const fake = fakeStore([
      listed(null, [first, row("second", 3)]),
      listed("next", [row("third")]),
      loading("later"),
    ]);

    markReadInLists(fake.store, { notificationId: notificationId("first") });

    expect(readTimesOf(fake)).toEqual([
      [expect.any(Number), 3],
      [undefined],
      null,
    ]);
    expect(fake.writes()).toBe(2);
  });

  it("marks every loaded row read at once and keeps the read time of the rows read already", () => {
    const fake = fakeStore([
      listed(null, [row("first"), row("second", 3)]),
      listed("next", [row("third")]),
      loading("later"),
    ]);

    markAllReadInLists(fake.store, {});

    expect(readTimesOf(fake)).toEqual([
      [expect.any(Number), 3],
      [expect.any(Number)],
      null,
    ]);
    expect(fake.writes()).toBe(2);
  });
});
