import { QueryResult } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ClassAmbiguous } from "@repo/backend/confect/classroom/errors";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, use, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { ActionLink } from "@/components/state/action";
import { Missing } from "@/components/state/missing";
import { AddChannel } from "@/components/tenant/classes/add";
import { ChannelList } from "@/components/tenant/classes/channels";
import { createChannelDrafts } from "@/components/tenant/classes/drafts";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { Link } from "@/lib/routing/link";
import { schoolClassTarget } from "@/lib/routing/school/target";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";
import type { readClassForumFn } from "@/lib/tenant/classes.functions";

/** The tabs of a class that have a page. The other tabs join with the slices that build them. */
const ClassTab = Schema.Literals(["home", "forum"]);
type ClassTab = typeof ClassTab.Type;

/** The first screen of a class page, which the page's loader read on the server. */
const ClassPreloadContext = createContext<ClassPreload | undefined>(undefined);

/**
 * The shell of one class page: the school header with the class's name, the class's tabs, and the
 * body of the tab. The class is read by its address once Convex has settled the session, and the
 * server decides whether the viewer reads it, so a class the viewer may not read shows the missing
 * state. A failed read shows its own sentence and Try again beside the header, and a viewer who lost
 * the school's access is sent to the refused page. The header's one action is the forum's add, which
 * shows only when the server grants the viewer the forum's management.
 */
export function ClassShell({
  classSlug,
  preload,
  slug,
  tab,
}: {
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
      <ClassPreloadContext value={preload}>
        <ClassPage classSlug={classSlug} slug={slug} tab={tab} />
      </ClassPreloadContext>
    </ReadBoundary>
  );
}

/** The first screen of a class page, which its loader read on the server: the class and its first channels. */
type ClassPreload = Pick<
  Awaited<ReturnType<typeof readClassForumFn>>,
  "channels" | "resolved"
>;

/** The class page once the class is resolved: its header, its tabs, and the body of the tab. */
function ClassPage({
  classSlug,
  slug,
  tab,
}: {
  classSlug: string;
  slug: TenantSlug;
  tab: ClassTab;
}) {
  const preload = use(ClassPreloadContext);
  const t = useTranslations("Classroom");
  // The class is read once the session settles, so the first draw never asks for it signed out.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const resolved = usePreloadedQueryResult(
    classroom.classes.resolve,
    isSettled ? { classSlug, slug } : "skip",
    preload?.resolved
  );
  const [drafts] = useState(createChannelDrafts);

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

  const klass = resolved.value;
  const canManageForum = Arr.contains(klass.can, "forum.manage");
  const classItem = {
    label: klass.name,
    target: schoolClassTarget(slug, classSlug),
  };
  const path =
    tab === "home"
      ? [{ label: klass.name }]
      : [classItem, { label: t("tabs-forum") }];

  return (
    <>
      <SchoolHeader items={path} title={klass.name}>
        {tab === "forum" && canManageForum ? (
          <AddChannel classId={klass.id} drafts={drafts} slug={slug} />
        ) : null}
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        <ClassTabs classSlug={classSlug} tab={tab} />
        <ChannelList
          classId={klass.id}
          drafts={drafts}
          first={Option.fromUndefinedOr(preload?.channels)}
          slug={slug}
        />
      </LayoutContent>
    </>
  );
}

/** The tab bar of a class: its home and its forum, the current one marked as the page. */
function ClassTabs({ classSlug, tab }: { classSlug: string; tab: ClassTab }) {
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
        className={classTab({ active: tab === "forum" })}
        params={params}
        to="/school/$slug/classes/$classSlug/forum"
      >
        {t("tabs-forum")}
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
