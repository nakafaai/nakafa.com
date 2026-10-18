"use client";

import { QueryResult, useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { cn } from "cn";
import { Array as Arr, Schema } from "effect";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import { LayoutContent } from "@/components/shared/content/layout";
import { ActionLink } from "@/components/state/action";
import { Missing } from "@/components/state/missing";
import { AddChannel } from "@/components/tenant/classes/add";
import { ChannelList } from "@/components/tenant/classes/channels";
import { createChannelDrafts } from "@/components/tenant/classes/drafts";
import { SchoolHeader } from "@/components/tenant/header";

/** The tabs of a class that have a page. The other tabs join with the slices that build them. */
const ClassTab = Schema.Literals(["home", "forum"]);
type ClassTab = typeof ClassTab.Type;

/**
 * The shell of one class page: the school header with the class's name, the class's tabs, and the
 * body of the tab. The class is read by its address, and the server decides whether the viewer
 * reads it, so a class the viewer may not read shows the missing state. The header's one action
 * is the forum's add, which shows only when the server grants the viewer the forum's management.
 */
export function ClassShell({
  classSlug,
  slug,
  tab,
}: {
  classSlug: string;
  slug: TenantSlug;
  tab: ClassTab;
}) {
  const t = useTranslations("Classroom");
  const resolved = useQuery(classroom.classes.resolve, { classSlug, slug });
  const [drafts] = useState(createChannelDrafts);

  if (QueryResult.isFailure(resolved)) {
    return <ClassMissing />;
  }
  if (!QueryResult.isSuccess(resolved)) {
    return <SchoolHeader items={[]} />;
  }

  const klass = resolved.value;
  const canManageForum = Arr.contains(klass.can, "forum.manage");
  const classItem = { href: `/classes/${classSlug}`, label: klass.name };
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
        <ChannelList classId={klass.id} drafts={drafts} slug={slug} />
      </LayoutContent>
    </>
  );
}

/** The tab bar of a class: its home and its forum, the current one marked as the page. */
function ClassTabs({ classSlug, tab }: { classSlug: string; tab: ClassTab }) {
  const t = useTranslations("Classroom");
  const base = `/classes/${classSlug}`;

  return (
    <nav className="flex gap-1 border-b">
      <ClassTabLink active={tab === "home"} href={base}>
        {t("tabs-home")}
      </ClassTabLink>
      <ClassTabLink active={tab === "forum"} href={`${base}/forum`}>
        {t("tabs-forum")}
      </ClassTabLink>
    </nav>
  );
}

/** One tab of a class. The current tab is marked as the page, and its underline marks it too. */
function ClassTabLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-3 pb-2 font-medium text-sm",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

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
