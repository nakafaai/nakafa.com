import { PaginatedQueryResult, QueryResult } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ClassResolved } from "@repo/backend/confect/classroom/classes.spec";
import { ClassAmbiguous } from "@repo/backend/confect/classroom/errors";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { PanesProvider } from "@/components/shared/panes";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { ActionLink } from "@/components/state/action";
import { Missing } from "@/components/state/missing";
import { AddChannel } from "@/components/tenant/classes/add";
import {
  CHANNEL_PAGE_SIZE,
  ChannelList,
} from "@/components/tenant/classes/channels";
import { createChannelDrafts } from "@/components/tenant/classes/drafts";
import { ForumChannel } from "@/components/tenant/classes/forum/channel";
import { channelLabel } from "@/components/tenant/classes/label";
import { useTenant } from "@/components/tenant/context";
import {
  ClassGradebook,
  GradebookFilters,
} from "@/components/tenant/grades/sheet";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { Link } from "@/lib/routing/link";
import {
  schoolClassForumTarget,
  schoolClassTarget,
} from "@/lib/routing/school/target";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";
import type { readClassForumFn } from "@/lib/tenant/classes.functions";

/** The tabs of a class that have a page. The other tabs join with the slices that build them. */
const ClassTab = Schema.Literals(["home", "forum", "grades"]);
type ClassTab = typeof ClassTab.Type;

/**
 * What the class page's address and loader decide: its tab, the channel its forum shows, and the
 * first screen, which the loader read on the server.
 */
const ClassPageContext = createContext<{
  channel: Option.Option<Id<"classroomChannels">>;
  preload: ClassPreload | undefined;
  tab: ClassTab;
} | null>(null);

/** Reads what the class page's address and loader decide. It throws outside a class page. */
function useClassPage() {
  const page = use(ClassPageContext);
  if (page === null) {
    throw new Error("useClassPage must be used within ClassShell");
  }
  return page;
}

/**
 * The shell of one class page: the school header with the class's name, the class's tabs, and the
 * body of the tab. The class is read by its address once Convex has settled the session, and the
 * server decides whether the viewer reads it, so a class the viewer may not read shows the missing
 * state. A failed read shows its own sentence and Try again beside the header, and a viewer who lost
 * the school's access is sent to the refused page. The header's one action is the forum's add, which
 * shows only when the server grants the viewer the forum's management.
 */
export function ClassShell({
  channel,
  classSlug,
  preload,
  slug,
  tab,
}: {
  channel: Option.Option<Id<"classroomChannels">>;
  classSlug: string;
  preload: ClassPreload | undefined;
  slug: TenantSlug;
  tab: ClassTab;
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
      <ClassPageContext value={{ channel, preload, tab }}>
        <ClassPage classSlug={classSlug} slug={slug} />
      </ClassPageContext>
    </ReadBoundary>
  );
}

/**
 * The first screen of a class page, which its loader read on the server: the class, and the
 * first channels on the tabs that list them. The gradebook's loader reads no channel.
 */
type ClassPreload = Pick<
  Awaited<ReturnType<typeof readClassForumFn>>,
  "resolved"
> &
  Partial<Pick<Awaited<ReturnType<typeof readClassForumFn>>, "channels">>;

/**
 * The class page once the class is resolved: its gradebook, or its home and its forum. A class the
 * viewer may not read shows the missing state.
 */
function ClassPage({
  classSlug,
  slug,
}: {
  classSlug: string;
  slug: TenantSlug;
}) {
  const { channel, preload, tab } = useClassPage();
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
  if (tab === "grades") {
    return (
      <ClassGrades classSlug={classSlug} klass={resolved.value} slug={slug} />
    );
  }

  return (
    <ClassForum
      classSlug={classSlug}
      klass={resolved.value}
      shown={tab === "forum" ? channel : Option.none()}
      slug={slug}
      tab={tab}
    />
  );
}

/**
 * The gradebook of a class: the header with the gradebook's filters, the tabs, and the class's
 * students with the open student's grade in two panes.
 */
function ClassGrades({
  classSlug,
  klass,
  slug,
}: {
  classSlug: string;
  klass: typeof ClassResolved.Type;
  slug: TenantSlug;
}) {
  const t = useTranslations("Classroom");

  return (
    <TableFiltersProvider>
      <PanesProvider>
        <SchoolHeader
          items={[
            { label: klass.name, target: schoolClassTarget(slug, classSlug) },
            { label: t("tabs-grades") },
          ]}
          title={klass.name}
        >
          <GradebookFilters />
        </SchoolHeader>
        {/* The header's 4rem and the tabs row's 3rem sit above the gradebook's panes. */}
        <ClassFrame>
          <ClassTabs
            canGrade={Arr.contains(klass.can, "grade.list")}
            classSlug={classSlug}
            tab="grades"
          />
          <div className="flex min-h-0 flex-1 flex-col [--panes-offset:7rem]">
            <ClassGradebook classId={klass.id} slug={slug} />
          </div>
        </ClassFrame>
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/**
 * The home and the forum of a class: the header, whose one action is the forum's add for a viewer
 * the server grants the forum's management, the tabs, and the channel list, or the messages of the
 * channel the address names, whose name ends the page's path.
 */
function ClassForum({
  classSlug,
  klass,
  shown,
  slug,
  tab,
}: {
  classSlug: string;
  klass: typeof ClassResolved.Type;
  shown: Option.Option<Id<"classroomChannels">>;
  slug: TenantSlug;
  tab: Exclude<ClassTab, "grades">;
}) {
  const { preload } = useClassPage();
  const t = useTranslations("Classroom");
  const [drafts] = useState(createChannelDrafts);
  // The channel's name ends the path, read from the same channel list the forum shows.
  const channels = usePaginatedPreloaded(
    classroom.forum.channels.list,
    Option.isSome(shown) ? { classId: klass.id, slug } : "skip",
    { initialNumItems: CHANNEL_PAGE_SIZE },
    Option.fromUndefinedOr(preload?.channels)
  );
  const canManageForum = Arr.contains(klass.can, "forum.manage");
  const classItem = {
    label: klass.name,
    target: schoolClassTarget(slug, classSlug),
  };
  const shownChannel = Option.flatMap(shown, (channelId) =>
    PaginatedQueryResult.isFailure(channels)
      ? Option.none()
      : Arr.findFirst(channels.results, (found) => found.id === channelId)
  );
  const forumPath = Option.match(shownChannel, {
    onNone: () => [classItem, { label: t("tabs-forum") }],
    onSome: (found) => [
      classItem,
      {
        label: t("tabs-forum"),
        target: schoolClassForumTarget(slug, classSlug),
      },
      { label: channelLabel(found, t("general-channel")) },
    ],
  });

  return (
    <>
      <SchoolHeader
        items={tab === "home" ? [{ label: klass.name }] : forumPath}
        title={klass.name}
      >
        {tab === "forum" && Option.isNone(shown) && canManageForum ? (
          <AddChannel classId={klass.id} drafts={drafts} slug={slug} />
        ) : null}
      </SchoolHeader>
      <ClassFrame>
        <ClassTabs
          canGrade={Arr.contains(klass.can, "grade.list")}
          classSlug={classSlug}
          tab={tab}
        />
        <div className="wrap-anywhere flex flex-col gap-6 px-4 py-6">
          {Option.isSome(shown) ? (
            <ForumChannel
              canManage={canManageForum}
              canPost={Arr.contains(klass.can, "forum.post")}
              channelId={shown.value}
              classId={klass.id}
              slug={slug}
            />
          ) : (
            <ChannelList
              classId={klass.id}
              drafts={drafts}
              first={Option.fromUndefinedOr(preload?.channels)}
              slug={slug}
            />
          )}
        </div>
      </ClassFrame>
    </>
  );
}

/**
 * The frame of every class view: the tab bar, then the tab's body, in one column capped at the
 * app's widest content, so the tabs stand in the same place on every tab.
 */
function ClassFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col">
      {children}
    </div>
  );
}

/**
 * The tab bar of a class, one 3rem row on every tab: its home, its forum, and its gradebook for a
 * viewer who keeps the class's grades, the current one marked as the page.
 */
function ClassTabs({
  canGrade,
  classSlug,
  tab,
}: {
  canGrade: boolean;
  classSlug: string;
  tab: ClassTab;
}) {
  const t = useTranslations("Classroom");
  const { slug } = useTenant();
  const params = { classSlug, slug };

  return (
    <nav className="flex h-12 shrink-0 items-end gap-1 border-b px-4">
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
        className={classTab({ active: tab === "forum" })}
        params={params}
        to="/school/$slug/classes/$classSlug/forum"
      >
        {t("tabs-forum")}
      </Link>
      {canGrade ? (
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className={classTab({ active: tab === "grades" })}
          params={params}
          to="/school/$slug/classes/$classSlug/grades"
        >
          {t("tabs-grades")}
        </Link>
      ) : null}
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
  const t = useTranslations("NotFound");
  const tState = useTranslations("State");

  return (
    <>
      <SchoolHeader items={[]} />
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        <Missing description={t("description")} title={t("title")}>
          <ActionLink
            href="/"
            label={tState("home-button")}
            variant="default"
          />
        </Missing>
      </LayoutContent>
    </>
  );
}
