import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  Array as Arr,
  Effect,
  Option,
  Order,
  type Result,
  Schema,
} from "effect";
import { forumCall } from "@/components/tenant/classes/forum/call";

/** One announcement that waits for its time, as its author reads it. */
export type WaitingPost = Ref.Returns<typeof classroom.scheduled.list>[number];

const { list } = classroom.scheduled;

/** The arguments of one announcement kept for later, as the dialog gives them. */
type ScheduleArgs = Ref.Args<typeof classroom.scheduled.schedule>;

/** The order of the waiting announcements: the soonest first. */
const bySoonest = Order.mapInput(
  Order.Number,
  (post: WaitingPost) => post.publishAt
);

/** Writes what `change` makes of the class's waiting announcements that the store holds. */
const changeWaiting = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  change: (posts: readonly WaitingPost[]) => readonly WaitingPost[]
) => {
  for (const query of localStore.getAllQueries(list)) {
    if (Option.isSome(query.value) && query.args.classId === classId) {
      localStore.setQuery(
        list,
        query.args,
        Option.some(Arr.sort(change(query.value.value), bySoonest))
      );
    }
  }
};

/** Whether the server keeps the announcement: one just scheduled holds its client key as its ID until then. */
export const isSavedWaiting = (post: WaitingPost) => post.id !== post.clientKey;

/** Shows an announcement kept for later among the waiting ones at once. */
export const scheduleUpdate =
  (post: WaitingPost): OptimisticUpdate<typeof classroom.scheduled.schedule> =>
  (localStore, args) => {
    changeWaiting(localStore, args.classId, (posts) => [...posts, post]);
  };

/** Shows a waiting announcement's new time and text at once. */
export const editWaitingUpdate: OptimisticUpdate<
  typeof classroom.scheduled.edit
> = (localStore, args) => {
  changeWaiting(localStore, args.classId, (posts) =>
    Arr.map(posts, (post) =>
      post.id === args.scheduledId
        ? { ...post, publishAt: args.publishAt, text: args.text }
        : post
    )
  );
};

/** Takes a cancelled announcement away at once. */
export const cancelWaitingUpdate: OptimisticUpdate<
  typeof classroom.scheduled.cancel
> = (localStore, args) => {
  changeWaiting(localStore, args.classId, (posts) =>
    Arr.filter(posts, (post) => post.id !== args.scheduledId)
  );
};

/**
 * The announcement the teacher keeps for later, shown at once among the waiting ones under its client key, which is its
 * placeholder ID until the server answers. `schedule` is Confect's mutation with the optimistic update it is given.
 */
export const scheduleAnnouncement = Effect.fn("classroom.scheduled.schedule")(
  function* <E>(
    schedule: (
      update: ReturnType<typeof scheduleUpdate>,
      args: ScheduleArgs
    ) => Promise<Result.Result<WaitingPost, E>>,
    args: ScheduleArgs
  ) {
    const id = yield* Schema.decodeUnknownEffect(Id("classroomScheduled"))(
      args.clientKey
    );
    return yield* forumCall(() =>
      schedule(
        scheduleUpdate({
          clientKey: args.clientKey,
          email: args.email,
          id,
          publishAt: args.publishAt,
          text: args.text,
        }),
        args
      )
    );
  }
);
