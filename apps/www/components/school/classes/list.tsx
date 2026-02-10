"use client";

import {
  BookOpen02Icon,
  Calendar03Icon,
  MessageMultiple02Icon,
  MoreHorizontalIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  getClassImageUrl,
  getRandomClassImage,
} from "@repo/backend/convex/lib/images";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@repo/design-system/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { usePathname } from "@repo/internationalization/src/navigation";
import { usePaginatedQuery } from "convex/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { useSchool } from "@/lib/context/use-school";
import { searchParsers } from "@/lib/nuqs/search";

const DEBOUNCE_TIME = 300;

export function SchoolClassesList() {
  const t = useTranslations("School.Classes");

  const schoolId = useSchool((state) => state.school._id);
  const [{ q }] = useQueryStates(searchParsers);

  const [debouncedQ] = useDebouncedValue(q, DEBOUNCE_TIME);

  const { results, status, loadMore } = usePaginatedQuery(
    api.classes.queries.getClasses,
    {
      schoolId,
      q: debouncedQ,
    },
    { initialNumItems: 50 }
  );

  if (status === "LoadingFirstPage") {
    return null;
  }

  if (results.length === 0) {
    return (
      <div className="py-12">
        <p className="text-center text-muted-foreground text-sm">
          {t("no-classes-found")}
        </p>
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {results.map((c) => (
        <ClassItem cls={c} key={c._id} />
      ))}
      {status === "CanLoadMore" && (
        <Intersection onIntersect={() => loadMore(25)} />
      )}
    </section>
  );
}

function ClassItem({ cls }: { cls: Doc<"schoolClasses"> }) {
  const pathname = usePathname();
  const [imageError, setImageError] = useState(false);
  const imageSrc = imageError
    ? getClassImageUrl(getRandomClassImage(`${cls._id}`))
    : getClassImageUrl(cls.image);

  const t = useTranslations("School.Classes");

  return (
    <Card className="relative gap-0 overflow-hidden p-0 transition-colors ease-out hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--primary)_1%,var(--background))]">
      <NavigationLink
        className="absolute inset-0 z-1"
        href={`${pathname}/${cls._id}`}
      />
      <div className="p-2">
        <div className="relative h-32 overflow-hidden rounded-md">
          <Image
            alt={cls.name}
            className="bg-[color-mix(in_oklch,var(--primary)_2.5%,var(--background))] object-cover"
            fetchPriority="high"
            fill
            loading="eager"
            onError={() => setImageError(true)}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            src={imageSrc}
            title={cls.name}
          />
        </div>
      </div>
      <CardContent className="px-6 pt-2 pb-4 leading-tight">
        <h2 className="truncate font-medium">{cls.name}</h2>
        <p className="truncate text-muted-foreground text-sm">{cls.subject}</p>
      </CardContent>
      <CardFooter className="z-2 justify-between border-t px-4 pb-2 [.border-t]:pt-2">
        <Badge className="min-w-0 shrink-0" variant="muted">
          <HugeIcons icon={Calendar03Icon} />
          <span className="truncate">{cls.year}</span>
        </Badge>

        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  nativeButton={false}
                  render={
                    <NavigationLink href={`${pathname}/${cls._id}/materials`}>
                      <HugeIcons icon={BookOpen02Icon} />
                    </NavigationLink>
                  }
                  size="icon-sm"
                  variant="ghost"
                />
              }
            />
            <TooltipContent side="bottom">{t("materials")}</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <HugeIcons icon={MoreHorizontalIcon} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild className="cursor-pointer">
                <NavigationLink href={`${pathname}/${cls._id}/forum`}>
                  <HugeIcons icon={MessageMultiple02Icon} />
                  {t("forum")}
                </NavigationLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <NavigationLink href={`${pathname}/${cls._id}/people`}>
                  <HugeIcons icon={UserMultipleIcon} />
                  {t("people")}
                </NavigationLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
}
