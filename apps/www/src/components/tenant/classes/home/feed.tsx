import { Archive02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "cn";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { pageRowVariants } from "@/components/shared/content/width";
import { ClassHeader } from "@/components/tenant/classes/header";
import { NewAnnouncement } from "@/components/tenant/classes/home/compose";
import { ClassHome } from "@/components/tenant/classes/home/home";
import { NewPostPoll } from "@/components/tenant/classes/home/poll";

/**
 * The class's announcements, with New announcement for its subject teachers, and Archived, which shows the archived
 * announcements in their place until it is pressed again.
 */
export function HomeFeed({ publishes }: { publishes: boolean }) {
  const t = useTranslations("Classroom");
  const [archived, setArchived] = useState(false);

  return (
    <>
      <ClassHeader>
        {publishes ? (
          <ButtonGroup>
            <Button
              aria-pressed={archived}
              onClick={() => setArchived((shown) => !shown)}
              variant={archived ? "secondary" : "outline"}
            >
              <HugeIcons aria-hidden="true" icon={Archive02Icon} />
              <span className="@max-sm/header:sr-only">
                {t("posts-archived")}
              </span>
            </Button>
            <NewPostPoll />
            <NewAnnouncement />
          </ButtonGroup>
        ) : null}
      </ClassHeader>
      <ClassScroll>
        <ClassHome archived={archived} />
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
