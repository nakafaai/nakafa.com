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
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useSchool } from "@/lib/context/use-school";

export function SchoolSwitcher() {
  const { isMobile } = useSidebar();

  const t = useTranslations("School.Onboarding");

  const currentSchool = useSchool((s) => s.school);
  const schools = useQuery(api.schools.queries.getMySchools);

  const mySchools = useMemo(() => schools ?? [], [schools]);

  const currentSchoolIcon = getSchoolIcon(currentSchool.type);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
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
            {mySchools.map((school) => {
              const schoolIconItem = getSchoolIcon(school.type);

              return (
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer"
                  key={school._id}
                >
                  <NavigationLink href={`/school/${school.slug}`}>
                    <HugeIcons className="shrink-0" icon={schoolIconItem} />
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
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <NavigationLink href="/school/onboarding">
                <HugeIcons className="shrink-0" icon={Add01Icon} />
                <span className="truncate">{t("add-school")}</span>
              </NavigationLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

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
