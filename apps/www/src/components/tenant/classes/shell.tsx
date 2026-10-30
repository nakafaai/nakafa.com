import type { Ref } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ClassResolved } from "@repo/backend/confect/classroom/classes.spec";
import { ClassAmbiguous } from "@repo/backend/confect/classroom/errors";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { PanesProvider } from "@/components/shared/panes";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import {
  CHANNEL_PAGE_SIZE,
  ChannelList,
} from "@/components/tenant/classes/channels";
import { ForumChannel } from "@/components/tenant/classes/forum/channel";
import { StartDiscussion } from "@/components/tenant/classes/forum/start";
import { ForumDiscussion } from "@/components/tenant/classes/forum/thread";
import {
  ClassHeader,
  ClassHeaderProvider,
} from "@/components/tenant/classes/header";
import { NewAnnouncement } from "@/components/tenant/classes/home/compose";
import { ClassHome } from "@/components/tenant/classes/home/home";
import { channelLabel } from "@/components/tenant/classes/label";
import { LibraryList } from "@/components/tenant/classes/library/list";
import { LibraryUploadsScope } from "@/components/tenant/classes/library/scope";
import { ClassMissingBody } from "@/components/tenant/classes/missing";
import { classPath } from "@/components/tenant/classes/path";
import {
  ClassScopeContext,
  useClassScope,
} from "@/components/tenant/classes/scope";
import { TaskList } from "@/components/tenant/classes/tasks/list";
import { TaskPage } from "@/components/tenant/classes/tasks/page";
import type { ClassView } from "@/components/tenant/classes/view";
import {
  ClassGradebook,
  GradebookSearch,
} from "@/components/tenant/grades/sheet";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";

/** What the class page shows, which the class shell provides to the parts that draw it. */
const ClassViewContext = createContext<typeof ClassView.Type | null>(null);

/** Reads what the class page around the caller shows. */
function useClassView() {
  const view = use(ClassViewContext);

  if (view === null) {
    throw new Error("useClassView must be used within a class shell");
  }

  return view;
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
  slug,
  view,
}: {
  classSlug: string;
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
      <ClassViewContext value={view}>
        <ClassPage classSlug={classSlug} slug={slug} />
      </ClassViewContext>
    </ReadBoundary>
  );
}

/** One class as its page resolves it, with the actions the viewer may take. */
type Resolved = typeof ClassResolved.Type;

/**
 * The class page: the class is read by its address once Convex has settled the session, and a
 * class the viewer may not read shows the missing state. Until the class arrives the header stands
 * alone, so nothing invented fills the page.
 */
function ClassPage({
  classSlug,
  slug,
}: {
  classSlug: string;
  slug: TenantSlug;
}) {
  // The class is read once the session settles, so the first draw never asks for it signed out.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const resolved = useQuery(
    classroom.classes.resolve,
    isSettled ? { classSlug, slug } : "skip"
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
    <ClassScopeContext
      value={{
        can: resolved.value.can,
        classId: resolved.value.id,
        classSlug,
        slug,
      }}
    >
      <ResolvedClass klass={resolved.value} />
    </ClassScopeContext>
  );
}

/**
 * The resolved class: the path and the title that its header shows, given to the view, which
 * draws the header with its own actions, the tabs, and its body. The channel's name and the
 * discussion's number and title end the path, read from the same channel list and discussion the
 * forum shows. A discussion the class does not hold shows the missing state.
 */
function ResolvedClass({ klass }: { klass: Resolved }) {
  const view = useClassView();
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();
  const thread = useQuery(
    classroom.forum.threads.get,
    view._tag === "discussion"
      ? { classId: klass.id, number: view.number, slug }
      : "skip"
  );
  const channels = usePaginatedQuery(
    classroom.forum.channels.list,
    view._tag === "channel" || view._tag === "discussion"
      ? { classId: klass.id, slug }
      : "skip",
    { initialNumItems: CHANNEL_PAGE_SIZE }
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
      grades: t("tabs-grades"),
      library: t("tabs-library"),
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
    <ClassHeaderProvider items={path} tab={view._tag} title={klass.name}>
      {/* The class fills the screen: the header and the tabs keep their height, and the body takes the rest. */}
      <div className="flex h-svh min-h-0 flex-col">
        <ClassBody found={found} klass={klass} />
      </div>
    </ClassHeaderProvider>
  );
}

/**
 * The view under the class's header, as wide as the page, each with the header's actions it
 * holds: one channel fills the body as a chat does, with New discussion for whoever the server
 * lets open one there, and one discussion beside its channel; the class's announcements, with New
 * announcement for its subject teachers, and one task scroll within it; the channel list, the
 * library and the task list each draw their header and their one table card; and the gradebook
 * shares its filters and its panes between its header and its body.
 */
function ClassBody({
  found,
  klass,
}: {
  found: Option.Option<Ref.Returns<typeof classroom.forum.threads.get>>;
  klass: Resolved;
}) {
  const view = useClassView();
  const { slug } = useClassScope();
  const canManage = Arr.contains(klass.can, "forum.manage");
  const canPost = Arr.contains(klass.can, "forum.post");
  // A subject teacher, the one who posts announcements, may mention everyone (ADR 0025).
  const everyone = Arr.contains(klass.can, "post.publish");

  if (view._tag === "channel") {
    return (
      <>
        <ClassHeader>
          {klass.opens ? <StartDiscussion channelId={view.channelId} /> : null}
        </ClassHeader>
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
          <ForumChannel
            canManage={canManage}
            canPost={canPost}
            channelId={view.channelId}
            everyone={everyone}
            jump={view.jump}
          />
        </div>
      </>
    );
  }
  if (view._tag === "discussion") {
    return (
      <>
        <ClassHeader />
        {Option.match(found, {
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
        })}
      </>
    );
  }
  if (view._tag === "home") {
    return (
      <>
        <ClassHeader>
          {Arr.contains(klass.can, "post.publish") ? <NewAnnouncement /> : null}
        </ClassHeader>
        <ClassScroll>
          <ClassHome />
        </ClassScroll>
      </>
    );
  }
  if (view._tag === "library") {
    return (
      <LibraryUploadsScope>
        <LibraryList />
      </LibraryUploadsScope>
    );
  }
  if (view._tag === "tasks") {
    return <TaskList />;
  }
  if (view._tag === "grades") {
    return (
      <TableFiltersProvider>
        <PanesProvider>
          <ClassHeader>
            <GradebookSearch />
          </ClassHeader>
          {/* The header's 4rem and the tabs' 3rem stand above the gradebook's panes. */}
          <div className="flex min-h-0 flex-1 flex-col [--panes-offset:7rem]">
            <ClassGradebook classId={klass.id} slug={slug} />
          </div>
        </PanesProvider>
      </TableFiltersProvider>
    );
  }
  if (view._tag === "task") {
    return (
      <>
        <ClassHeader />
        <ClassScroll>
          <TaskPage task={view.task} />
        </ClassScroll>
      </>
    );
  }
  return <ChannelList />;
}

/**
 * A body that scrolls within itself under the tabs, at the app's page width within the page's
 * margin, so the header and the tabs stay.
 */
function ClassScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="flex-1" viewportClassName="flex flex-col">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </div>
    </ScrollArea>
  );
}

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
