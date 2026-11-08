import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";
import { chosenVotes } from "@/components/tenant/classes/forum/tally";
import { changeLoaded, withPage } from "@/lib/data/loaded";

/** One announcement of a class, as its home shows it. */
export type ClassPost = Ref.Returns<
  typeof classroom.posts.list
>["page"][number];

const { list, pinned, votes } = classroom.posts;

/**
 * Writes what `change` makes of each page of the class's announcements that the store holds. A
 * page that `change` answers none for is left as it was.
 */
const changePages = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  change: (
    page: readonly ClassPost[],
    first: boolean
  ) => Option.Option<ClassPost[]>
) => {
  changeLoaded(localStore, list, (value, args) =>
    args.classId === classId
      ? Option.map(
          change(value.page, args.paginationOpts.cursor === null),
          (page) => withPage(value, () => page)
        )
      : Option.none()
  );
};

/** Shows an announcement the teacher posts first on the class home, before the server holds it. */
export const publishUpdate =
  (post: ClassPost): OptimisticUpdate<typeof classroom.posts.publish> =>
  (localStore, args) => {
    changePages(localStore, args.classId, (page, first) =>
      first ? Option.some([post, ...page]) : Option.none()
    );
  };

/** Shows the teacher's new text of an announcement at once, edited at `at`. */
export const editPostUpdate =
  (at: number): OptimisticUpdate<typeof classroom.posts.edit> =>
  (localStore, args) => {
    changePages(localStore, args.classId, (page) =>
      Arr.some(page, (post) => post.id === args.postId)
        ? Option.some(
            Arr.map(page, (post) =>
              post.id === args.postId
                ? { ...post, editedAt: at, text: args.text }
                : post
            )
          )
        : Option.none()
    );
  };

/** Takes a removed announcement off the class home at once. */
export const removePostUpdate: OptimisticUpdate<
  typeof classroom.posts.remove
> = (localStore, args) => {
  changePages(localStore, args.classId, (page) =>
    Arr.some(page, (post) => post.id === args.postId)
      ? Option.some(Arr.filter(page, (post) => post.id !== args.postId))
      : Option.none()
  );
};

/**
 * Shows an announcement pinned or taken down at once: its flag on every page that holds it, and its place at the top
 * of the home, where a pinned one comes first.
 */
export const pinPostUpdate =
  (post: ClassPost): OptimisticUpdate<typeof classroom.posts.pin> =>
  (localStore, args) => {
    changePages(localStore, args.classId, (page) =>
      Arr.some(page, (found) => found.id === args.postId)
        ? Option.some(
            Arr.map(page, (found) =>
              found.id === args.postId
                ? { ...found, pinned: args.pinned }
                : found
            )
          )
        : Option.none()
    );
    changeLoaded(localStore, pinned, (posts, loaded) => {
      if (loaded.classId !== args.classId) {
        return Option.none();
      }
      const others = Arr.filter(posts, (found) => found.id !== args.postId);
      return Option.some(
        args.pinned ? [{ ...post, pinned: true }, ...others] : others
      );
    });
  };

/** Takes an announcement off the class home and its pins at once; a refusal brings it back. */
const leaveHome = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  postId: Id<"classroomPosts">
) => {
  changePages(localStore, classId, (page) =>
    Arr.some(page, (post) => post.id === postId)
      ? Option.some(Arr.filter(page, (post) => post.id !== postId))
      : Option.none()
  );
  changeLoaded(localStore, pinned, (posts, args) =>
    args.classId === classId
      ? Option.some(Arr.filter(posts, (post) => post.id !== postId))
      : Option.none()
  );
};

/** Takes an archived announcement off the class home and its pins at once. */
export const archivePostUpdate: OptimisticUpdate<
  typeof classroom.posts.archive
> = (localStore, args) => leaveHome(localStore, args.classId, args.postId);

/** Takes a restored announcement off the archived ones at once. */
export const restorePostUpdate: OptimisticUpdate<
  typeof classroom.posts.restore
> = (localStore, args) => leaveHome(localStore, args.classId, args.postId);

/** Shows the viewer's choices in a poll at once, in every read that holds its post. */
export const votePostUpdate: OptimisticUpdate<typeof classroom.posts.vote> = (
  localStore,
  args
) => {
  changeLoaded(localStore, votes, (tallies, loaded) => {
    if (!Arr.contains(loaded.postIds, args.postId)) {
      return Option.none();
    }
    const held = Option.match(
      Arr.findFirst(tallies, (found) => found.postId === args.postId),
      { onNone: () => [], onSome: (found) => found.votes }
    );
    return Option.some([
      ...Arr.filter(tallies, (found) => found.postId !== args.postId),
      { postId: args.postId, votes: chosenVotes(held, args.options) },
    ]);
  });
};
