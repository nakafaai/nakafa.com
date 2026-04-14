"use client";

import {
  Add01Icon,
  Backpack01Icon,
  Briefcase01Icon,
  LibraryIcon,
  Notebook01Icon,
  SchoolIcon,
  Tick01Icon,
  UnfoldMoreIcon,
  UniversityIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSchool } from "@/lib/context/use-school";

type SchoolSwitcherPage = FunctionReturnType<
  typeof api.schools.queries.getMySchoolsPage
>;

/** Render the school switcher with a server-preloaded first page. */
export function SchoolSwitcher({
  initialSchoolPage,
}: {
  initialSchoolPage: SchoolSwitcherPage;
}) {
  const { isMobile } = useSidebar();
  const t = useTranslations("School.Onboarding");
  const router = useRouter();
  const currentSchool = useSchool((state) => state.school);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [open, setOpen] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.schools.queries.getMySchoolsPage,
    open && isAuthenticated && !isLoading ? {} : "skip",
    { initialNumItems: 20 }
  );
  const schools = results.length > 0 ? results : initialSchoolPage.page;

  const currentSchoolIcon = getSchoolIcon(currentSchool.type);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={setOpen} open={open}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-sm border bg-foreground text-background">
                <HugeIcons className="size-4" icon={currentSchoolIcon} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <p className="truncate font-medium">{currentSchool.name}</p>
                <span className="truncate text-xs">
                  {t(currentSchool.type)}
                </span>
              </div>
              <HugeIcons className="ml-auto" icon={UnfoldMoreIcon} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {t("schools")}
            </DropdownMenuLabel>
            <div
              className="max-h-64 overflow-y-auto"
              onScroll={(event) => {
                const target = event.currentTarget;
                const remainingScroll =
                  target.scrollHeight - target.scrollTop - target.clientHeight;

                if (remainingScroll > 48) {
                  return;
                }

                if (status === "CanLoadMore") {
                  loadMore(20);
                }
              }}
            >
              {schools.map((school) => {
                const schoolIcon = getSchoolIcon(school.type);

                return (
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer"
                    key={school._id}
                  >
                    <NavigationLink href={`/school/${school.slug}`}>
                      <HugeIcons className="shrink-0" icon={schoolIcon} />
                      <span className="truncate">{school.name}</span>
                      <HugeIcons
                        className={cn(
                          "ml-auto size-4 opacity-0 transition-opacity ease-out",
                          currentSchool._id === school._id && "opacity-100"
                        )}
                        icon={Tick01Icon}
                      />
                    </NavigationLink>
                  </DropdownMenuItem>
                );
              })}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                router.push("/school/onboarding");
                setOpen(false);
              }}
            >
              <HugeIcons className="shrink-0" icon={Add01Icon} />
              <span className="truncate">{t("add-school")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Return the icon used for one school type in the school switcher. */
function getSchoolIcon(type: Doc<"schools">["type"]) {
  switch (type) {
    case "elementary-school":
      return Backpack01Icon;
    case "middle-school":
      return Notebook01Icon;
    case "high-school":
      return LibraryIcon;
    case "vocational-school":
      return Briefcase01Icon;
    case "university":
      return UniversityIcon;
    default:
      return SchoolIcon;
  }
}
