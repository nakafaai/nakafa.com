import {
  ChartBarLineIcon,
  Home01Icon,
  LibraryIcon,
  MessageMultiple01Icon,
  Task01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Match } from "effect";
import { useTranslations } from "use-intl";
import { pageRowVariants } from "@/components/shared/content/width";
import type { ClassView } from "@/components/tenant/classes/view";
import { useTenant } from "@/components/tenant/context";
import { Link } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/** The tab of a view: a chat and a discussion stand under the forum, a folder under the library, and a task under the tasks. */
const tabOfView = Match.type<(typeof ClassView.Type)["_tag"]>().pipe(
  Match.whenOr("channel", "discussion", () => "forum"),
  Match.when("folder", () => "library"),
  Match.when("task", () => "tasks"),
  Match.orElse((view) => view)
);

/**
 * The toolbar row of a class under its header, one height on every view: its home, its forum, its
 * library, its tasks, its people, and its gradebook for a viewer who keeps the class's grades, each with its
 * icon, the current one marked as the page. On a narrow screen the row scrolls within itself,
 * never the page.
 */
export function ClassTabs({
  canGrade,
  classSlug,
  tab,
}: {
  /** Whether the viewer keeps the class's grades, so the gradebook is one of the tabs. */
  canGrade: boolean;
  classSlug: string;
  tab: (typeof ClassView.Type)["_tag"];
}) {
  const t = useTranslations("Classroom");
  const { slug } = useTenant();
  const params = { classSlug, slug };

  return (
    <Tabs value={tabOfView(tab)}>
      <TabsList aria-label={t("tabs-label")} className={pageRowVariants()}>
        <TabsTab
          nativeButton={false}
          render={
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              params={params}
              to="/school/$slug/classes/$classSlug"
            >
              <HugeIcons icon={Home01Icon} />
              {t("tabs-home")}
            </Link>
          }
          value="home"
        />
        <TabsTab
          nativeButton={false}
          render={
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              params={params}
              to="/school/$slug/classes/$classSlug/forum"
            >
              <HugeIcons icon={MessageMultiple01Icon} />
              {t("tabs-forum")}
            </Link>
          }
          value="forum"
        />
        <TabsTab
          nativeButton={false}
          render={
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              params={params}
              to="/school/$slug/classes/$classSlug/library"
            >
              <HugeIcons icon={LibraryIcon} />
              {t("tabs-library")}
            </Link>
          }
          value="library"
        />
        <TabsTab
          nativeButton={false}
          render={
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              params={params}
              to="/school/$slug/classes/$classSlug/tasks"
            >
              <HugeIcons icon={Task01Icon} />
              {t("tabs-tasks")}
            </Link>
          }
          value="tasks"
        />
        <TabsTab
          nativeButton={false}
          render={
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              params={params}
              to="/school/$slug/classes/$classSlug/people"
            >
              <HugeIcons icon={UserGroupIcon} />
              {t("tabs-people")}
            </Link>
          }
          value="people"
        />
        {canGrade ? (
          <TabsTab
            nativeButton={false}
            render={
              <Link
                activeOptions={EXACT_ACTIVE_OPTIONS}
                params={params}
                to="/school/$slug/classes/$classSlug/grades"
              >
                <HugeIcons icon={ChartBarLineIcon} />
                {t("tabs-grades")}
              </Link>
            }
            value="grades"
          />
        ) : null}
      </TabsList>
    </Tabs>
  );
}
