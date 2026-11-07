import { Archive02Icon, Megaphone01Icon } from "@hugeicons/core-free-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "cn";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { pageRowVariants } from "@/components/shared/content/width";
import { TableViews } from "@/components/shared/table/views";
import { ClassHeader } from "@/components/tenant/classes/header";
import { NewAnnouncement } from "@/components/tenant/classes/home/compose";
import { ClassHome } from "@/components/tenant/classes/home/home";
import { NewPostPoll } from "@/components/tenant/classes/home/poll";

/**
 * The class's announcements, with New poll and, standing alone, New announcement for its subject teachers. In the
 * body, a subject teacher chooses between the live announcements and the archived ones, which take their place.
 */
export function HomeFeed({ publishes }: { publishes: boolean }) {
  const t = useTranslations("Classroom");
  const [view, setView] = useState<"archived" | "live">("live");

  return (
    <>
      <ClassHeader>
        {publishes ? (
          <>
            <NewPostPoll />
            <NewAnnouncement />
          </>
        ) : null}
      </ClassHeader>
      <ClassScroll>
        {publishes ? (
          <TableViews
            label={t("posts-views")}
            onChoose={setView}
            view={view}
            views={[
              { icon: Megaphone01Icon, label: t("view-active"), value: "live" },
              {
                icon: Archive02Icon,
                label: t("posts-archived"),
                value: "archived",
              },
            ]}
          />
        ) : null}
        <ClassHome archived={view === "archived"} />
      </ClassScroll>
    </>
  );
}

/**
 * A body that scrolls within itself under the tabs, in one row of the page, so the header and
 * the tabs stay.
 */
function ClassScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="flex-1" viewportClassName="flex flex-col">
      <div className={cn(pageRowVariants(), "flex flex-1 flex-col gap-6 py-6")}>
        {children}
      </div>
    </ScrollArea>
  );
}
