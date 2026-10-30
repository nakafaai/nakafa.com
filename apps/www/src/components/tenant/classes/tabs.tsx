import {
  ChartBarLineIcon,
  Home01Icon,
  LibraryIcon,
  MessageMultiple01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { useTranslations } from "use-intl";
import type { ClassView } from "@/components/tenant/classes/view";
import { useTenant } from "@/components/tenant/context";
import { Link } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/**
 * The toolbar row of a class under its header, one height on every view: its home, its forum, its
 * library, its tasks, and its gradebook for a viewer who keeps the class's grades, each with its
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
    // The line under the bar stands outside its scroller, so the current tab's underline covers it.
    <div className="shrink-0 border-b">
      <nav
        aria-label={t("tabs-label")}
        className="scrollbar-hide mx-auto -mb-px flex h-12 w-full max-w-7xl gap-1 overflow-x-auto px-1"
      >
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className={classTab({ active: tab === "home" })}
          params={params}
          to="/school/$slug/classes/$classSlug"
        >
          <HugeIcons icon={Home01Icon} />
          {t("tabs-home")}
        </Link>
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className={classTab({
            active:
              tab === "forum" || tab === "channel" || tab === "discussion",
          })}
          params={params}
          to="/school/$slug/classes/$classSlug/forum"
        >
          <HugeIcons icon={MessageMultiple01Icon} />
          {t("tabs-forum")}
        </Link>
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className={classTab({ active: tab === "library" })}
          params={params}
          to="/school/$slug/classes/$classSlug/library"
        >
          <HugeIcons icon={LibraryIcon} />
          {t("tabs-library")}
        </Link>
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className={classTab({ active: tab === "tasks" || tab === "task" })}
          params={params}
          to="/school/$slug/classes/$classSlug/tasks"
        >
          <HugeIcons icon={Task01Icon} />
          {t("tabs-tasks")}
        </Link>
        {canGrade ? (
          <Link
            activeOptions={EXACT_ACTIVE_OPTIONS}
            className={classTab({ active: tab === "grades" })}
            params={params}
            to="/school/$slug/classes/$classSlug/grades"
          >
            <HugeIcons icon={ChartBarLineIcon} />
            {t("tabs-grades")}
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

/** One tab of a class, its icon before its name. The current tab is marked as the page, and its underline marks it too. */
const classTab = cva(
  "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 font-medium text-sm [&_svg]:size-4",
  {
    variants: {
      active: {
        false: "border-transparent text-muted-foreground hover:text-foreground",
        true: "border-foreground text-foreground",
      },
    },
  }
);
