import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Result, Schema } from "effect";
import {
  cancelWaitingUpdate,
  editWaitingUpdate,
  isSavedWaiting,
  scheduleAnnouncement,
  scheduleUpdate,
  type WaitingPost,
} from "@/components/tenant/classes/home/waiting";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classOf = Schema.decodeUnknownSync(Id("classes"));
const waitingOf = Schema.decodeUnknownSync(Id("classroomScheduled"));
const classId = classOf("class-1");
const scope = { classId, slug };

/** An announcement that waits for its time. */
const post = (id: string, publishAt: number): WaitingPost => ({
  clientKey: `key-${id}-0000`,
  email: false,
  id: waitingOf(id),
  publishAt,
  text: id,
});

const soon = post("soon", 10);
const later = post("later", 20);

/** A store with the class's waiting announcements, another class's, and a read that has not arrived. */
const storeOf = () => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue([
    { args: scope, value: Option.some([soon, later]) },
    { args: { classId: classOf("class-2"), slug }, value: Option.some([]) },
    { args: scope, value: Option.none() },
  ]);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

describe("class home waiting announcements", () => {
  it("keeps the soonest first through a schedule, a new time and a cancel, in the class's list only", () => {
    const middle = post("middle", 15);
    const adding = storeOf();
    scheduleUpdate(middle)(adding.localStore, {
      ...scope,
      clientKey: middle.clientKey,
      email: false,
      publishAt: 15,
      text: middle.text,
    });
    expect(adding.setQuery.mock.calls).toEqual([
      [classroom.scheduled.list, scope, Option.some([soon, middle, later])],
    ]);

    const moving = storeOf();
    editWaitingUpdate(moving.localStore, {
      ...scope,
      publishAt: 30,
      scheduledId: soon.id,
      text: "Pindah",
    });
    expect(moving.setQuery.mock.calls).toEqual([
      [
        classroom.scheduled.list,
        scope,
        Option.some([later, { ...soon, publishAt: 30, text: "Pindah" }]),
      ],
    ]);

    const cancelling = storeOf();
    cancelWaitingUpdate(cancelling.localStore, {
      ...scope,
      scheduledId: soon.id,
    });
    expect(cancelling.setQuery.mock.calls).toEqual([
      [classroom.scheduled.list, scope, Option.some([later])],
    ]);
  });

  it("tells one the server keeps from one that holds its client key", () => {
    expect(isSavedWaiting(soon)).toBe(true);
    expect(isSavedWaiting({ ...soon, id: waitingOf(soon.clientKey) })).toBe(
      false
    );
  });

  it.effect(
    "schedules under the client key, shown before the server answers",
    () =>
      Effect.gen(function* () {
        const args = {
          ...scope,
          clientKey: "key-new-0000",
          email: true,
          publishAt: 15,
          text: "Baru",
        };
        const schedule = vi.fn((_update: unknown, _args: unknown) =>
          Promise.resolve(Result.succeed(soon))
        );
        expect(yield* scheduleAnnouncement(schedule, args)).toEqual(soon);
        const { localStore, setQuery } = storeOf();
        const update = schedule.mock.calls[0]?.[0];
        if (typeof update === "function") {
          update(localStore, args);
        }
        expect(setQuery.mock.calls[0]?.[2]).toEqual(
          Option.some([
            soon,
            {
              clientKey: args.clientKey,
              email: true,
              id: waitingOf(args.clientKey),
              publishAt: 15,
              text: "Baru",
            },
            later,
          ])
        );
      })
  );
});
