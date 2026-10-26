import type { Ref } from "@confect/core";
import { PaginatedQueryResult, QueryResult, useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ClassAmbiguous } from "@repo/backend/confect/classroom/errors";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, use, useState } from "react";
import { useTranslations } from "use-intl";
import type { StoreApi } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { AddChannel } from "@/components/tenant/classes/add";
import {
  CHANNEL_PAGE_SIZE,
  ChannelList,
} from "@/components/tenant/classes/channels";
import {
  type ChannelDrafts,
  createChannelDrafts,
} from "@/components/tenant/classes/drafts";
import { ForumChannel } from "@/components/tenant/classes/forum/channel";
import { StartDiscussion } from "@/components/tenant/classes/forum/start";
import { ForumDiscussion } from "@/components/tenant/classes/forum/thread";
import { NewAnnouncement } from "@/components/tenant/classes/home/compose";
import { ClassHome } from "@/components/tenant/classes/home/home";
import { channelLabel } from "@/components/tenant/classes/label";
import { ClassMissingBody } from "@/components/tenant/classes/missing";
import { classPath } from "@/components/tenant/classes/path";
import {
  ClassScopeContext,
  useClassScope,
} from "@/components/tenant/classes/scope";
import { NewTask } from "@/components/tenant/classes/tasks/create";
import { TaskList } from "@/components/tenant/classes/tasks/list";
import { TaskPage } from "@/components/tenant/classes/tasks/page";
import type { ClassView } from "@/components/tenant/classes/view";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { Link } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";
import type {
  readClassDiscussionFn,
  readClassForumFn,
} from "@/lib/tenant/classes.functions";

/** The first screen of a class page, which the page's loader read on the server. */
type ClassPreload =
  | Pick<Awaited<ReturnType<typeof readClassForumFn>>, "channels" | "resolved">
  | Awaited<ReturnType<typeof readClassDiscussionFn>>;

/** The first screen of a class page, which the page's loader read on the server. */
const ClassPreloadContext = createContext<ClassPreload | undefined>(undefined);

/** The channels the class page is saving, which the header's Add channel and the channel list share. */
const DraftsContext = createContext<StoreApi<ChannelDrafts> | null>(null);

/** Reads the channel drafts of the class page around the caller. */
function useDrafts() {
  const drafts = use(DraftsContext);

  if (drafts === null) {
    throw new Error("useDrafts must be used within a resolved class page");
  }

  return drafts;
}

/**
 * The shell of one class page: the school header with the class's path, the class's tabs, and the
 * body of the view. The class is read by its address once Convex has settled the session, and the
 * server decides whether the viewer reads it, so a class the viewer may not read shows the missing
 * state. A failed read shows its own sentence and Try again beside the header, and a viewer who lost
 * the school's access is sent to the refused page.
 */
export function ClassShell({
  classSlug,
  preload,
  slug,
  view,
}: {
  classSlug: string;
  preload: ClassPreload | undefined;
  slug: TenantSlug;
  view: typeof ClassView.Type;
}) {
  return (
    <ReadBoundary
      fallback={(failure) => (
        <>
          <SchoolHeader items={[]} />
          <LayoutContent className="py-6">{failure}</LayoutContent>
        </>
      )}
      read={{ args: { classSlug, slug }, ref: classroom.classes.resolve }}
    >
      <ClassPreloadContext value={preload}>
        <ClassPage classSlug={classSlug} slug={slug} view={view} />
      </ClassPreloadContext>
    </ReadBoundary>
  );
}

/** One class as its page resolves it, with the actions the viewer may take. */
type Resolved = Ref.Returns<typeof classroom.classes.resolve>;

/**
 * The class page: the class is read by its address once Convex has settled the session, and a
 * class the viewer may not read shows the missing state. Until the class arrives the header stands
 * alone, so nothing invented fills the page.
 */
function ClassPage({
  classSlug,
  slug,
  view,
}: {
  classSlug: string;
  slug: TenantSlug;
  view: typeof ClassView.Type;
}) {
  const preload = use(ClassPreloadContext);
  // The class is read once the session settles, so the first draw never asks for it signed out.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const resolved = usePreloadedQueryResult(
    classroom.classes.resolve,
    isSettled ? { classSlug, slug } : "skip",
    preload?.resolved
  );

  if (QueryResult.isFailure(resolved)) {
    if (isLostAccess(resolved.error)) {
      throw resolved.error;
    }
    if (isDenied(resolved.error) || Schema.is(ClassAmbiguous)(resolved.error)) {
      return <ClassMissing />;
    }
    throw resolved.error;
  }
  if (!QueryResult.isSuccess(resolved)) {
    return <SchoolHeader items={[]} />;
  }
  return (
    <ClassScopeContext value={{ classId: resolved.value.id, classSlug, slug }}>
      <ResolvedClass klass={resolved.value} view={view} />
    </ClassScopeContext>
  );
}

/**
 * The resolved class: its header, its tabs, and the body of the view. The channel's name and the
 * discussion's number and title end the path, read from the same channel list and discussion the
 * forum shows. A discussion the class does not hold shows the missing state.
 */
function ResolvedClass({
  klass,
  view,
}: {
  klass: Resolved;
  view: typeof ClassView.Type;
}) {
  const preload = use(ClassPreloadContext);
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();
  const [drafts] = useState(createChannelDrafts);
  const thread = usePreloadedQueryResult(
    classroom.forum.threads.get,
    view._tag === "discussion"
      ? { classId: klass.id, number: view.number, slug }
      : "skip",
    preload !== undefined && "thread" in preload ? preload.thread : undefined
  );
  const channels = usePaginatedPreloaded(
    classroom.forum.channels.list,
    view._tag === "channel" || view._tag === "discussion"
      ? { classId: klass.id, slug }
      : "skip",
    { initialNumItems: CHANNEL_PAGE_SIZE },
    Option.fromUndefinedOr(preload?.channels)
  );
  // A task's title ends the path, read from the same task its page shows.
  const task = useQuery(
    classroom.tasks.get,
    view._tag === "task" ? { classId: klass.id, slug, task: view.task } : "skip"
  );

  if (QueryResult.isFailure(thread)) {
    if (isLostAccess(thread.error)) {
      throw thread.error;
    }
    return <ClassMissing />;
  }
  const found = QueryResult.isSuccess(thread)
    ? Option.some(thread.value)
    : Option.none();
  const channelId =
    view._tag === "channel"
      ? Option.some(view.channelId)
      : Option.map(found, (shown) => shown.channelId);
  const listed = PaginatedQueryResult.isFailure(channels)
    ? []
    : channels.results;
  const path = classPath(
    view,
    {
      classSlug,
      forum: t("tabs-forum"),
      name: klass.name,
      slug,
      tasks: t("tabs-tasks"),
    },
    Option.map(
      Option.flatMap(channelId, (id) =>
        Arr.findFirst(listed, (channel) => channel.id === id)
      ),
      (channel) => ({
        id: channel.id,
        label: channelLabel(channel, t("general-channel")),
      })
    ),
    QueryResult.isSuccess(task)
      ? Option.some(task.value.title)
      : Option.map(found, (shown) =>
          t("discussion-label", {
            number: shown.discussion.number,
            title: shown.discussion.title,
          })
        )
  );

  return (
    <DraftsContext value={drafts}>
      <SchoolHeader items={path} title={klass.name}>
        <ForumAction klass={klass} view={view} />
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        <ClassTabs classSlug={classSlug} tab={view._tag} />
        <ClassBody found={found} klass={klass} view={view} />
      </LayoutContent>
    </DraftsContext>
  );
}

/**
 * The header's one action: New announcement on the class home for its subject teachers, Add
 * channel on the channel list for whoever manages the forum, New discussion in a channel for
 * whoever the server lets open one there, and New task on the task list for its teachers.
 */
function ForumAction({
  klass,
  view,
}: {
  klass: Resolved;
  view: typeof ClassView.Type;
}) {
  const { slug } = useClassScope();
  const drafts = useDrafts();

  if (view._tag === "home" && Arr.contains(klass.can, "post.publish")) {
    return <NewAnnouncement />;
  }
  if (view._tag === "forum" && Arr.contains(klass.can, "forum.manage")) {
    return <AddChannel classId={klass.id} drafts={drafts} slug={slug} />;
  }
  if (view._tag === "channel" && klass.opens) {
    return <StartDiscussion channelId={view.channelId} />;
  }
  if (view._tag === "tasks" && Arr.contains(klass.can, "task.manage")) {
    return <NewTask />;
  }
  return null;
}

/** The body of the view: the class's announcements, its channel list, one channel, or one discussion beside its channel. */
function ClassBody({
  found,
  klass,
  view,
}: {
  found: Option.Option<Ref.Returns<typeof classroom.forum.threads.get>>;
  klass: Resolved;
  view: typeof ClassView.Type;
}) {
  const preload = use(ClassPreloadContext);
  const drafts = useDrafts();
  const canManage = Arr.contains(klass.can, "forum.manage");
  const canPost = Arr.contains(klass.can, "forum.post");
  // A subject teacher, the one who posts announcements, may mention everyone (ADR 0025).
  const everyone = Arr.contains(klass.can, "post.publish");

  if (view._tag === "channel") {
    return (
      <ForumChannel
        canManage={canManage}
        canPost={canPost}
        channelId={view.channelId}
        everyone={everyone}
        jump={view.jump}
      />
    );
  }
  if (view._tag === "discussion") {
    return Option.match(found, {
      onNone: () => null,
      onSome: (thread) => (
        <ForumDiscussion
          canManage={canManage}
          canPost={canPost}
          everyone={everyone}
          jump={view.jump}
          thread={thread}
        />
      ),
    });
  }
  if (view._tag === "home") {
    return <ClassHome />;
  }
  if (view._tag === "tasks") {
    return <TaskList teacher={Arr.contains(klass.can, "task.manage")} />;
  }
  if (view._tag === "task") {
    return (
      <TaskPage
        task={view.task}
        teacher={Arr.contains(klass.can, "task.manage")}
      />
    );
  }
  return (
    <ChannelList
      drafts={drafts}
      first={Option.fromUndefinedOr(preload?.channels)}
    />
  );
}

/** The tab bar of a class: its home, its forum, and its tasks, the current one marked as the page. */
function ClassTabs({
  classSlug,
  tab,
}: {
  classSlug: string;
  tab: (typeof ClassView.Type)["_tag"];
}) {
  const t = useTranslations("Classroom");
  const { slug } = useTenant();
  const params = { classSlug, slug };

  return (
    <nav className="flex gap-1 border-b">
      <Link
        activeOptions={EXACT_ACTIVE_OPTIONS}
        className={classTab({ active: tab === "home" })}
        params={params}
        to="/school/$slug/classes/$classSlug"
      >
        {t("tabs-home")}
      </Link>
      <Link
        activeOptions={EXACT_ACTIVE_OPTIONS}
        className={classTab({
          active: tab === "forum" || tab === "channel" || tab === "discussion",
        })}
        params={params}
        to="/school/$slug/classes/$classSlug/forum"
      >
        {t("tabs-forum")}
      </Link>
      <Link
        activeOptions={EXACT_ACTIVE_OPTIONS}
        className={classTab({ active: tab === "tasks" || tab === "task" })}
        params={params}
        to="/school/$slug/classes/$classSlug/tasks"
      >
        {t("tabs-tasks")}
      </Link>
    </nav>
  );
}

/** One tab of a class. The current tab is marked as the page, and its underline marks it too. */
const classTab = cva("-mb-px border-b-2 px-3 pb-2 font-medium text-sm", {
  variants: {
    active: {
      false: "border-transparent text-muted-foreground hover:text-foreground",
      true: "border-foreground text-foreground",
    },
  },
});

/** The state of a class that the viewer may not read, with one way back to the school's home. */
function ClassMissing() {
  return (
    <>
      <SchoolHeader items={[]} />
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        <ClassMissingBody />
      </LayoutContent>
    </>
  );
}
