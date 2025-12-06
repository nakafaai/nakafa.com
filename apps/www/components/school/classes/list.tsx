"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { getRandomClassImage } from "@repo/backend/convex/classes/constants";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@repo/design-system/components/ui/card";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { usePathname } from "@repo/internationalization/src/navigation";
import { usePaginatedQuery } from "convex/react";
import { BookOpen, CalendarIcon, EllipsisIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { useSchool } from "@/lib/context/use-school";
import { searchParsers } from "@/lib/nuqs/search";

export function SchoolClassesList() {
  const t = useTranslations("School.Classes");

  const schoolId = useSchool((state) => state.school._id);
  const [{ q }] = useQueryStates(searchParsers);

  const { results, status } = usePaginatedQuery(
    api.classes.queries.getClasses,
    {
      schoolId,
      q,
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
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((c) => (
        <ClassItem cls={c} key={c._id} />
      ))}
    </section>
  );
}

function ClassItem({ cls }: { cls: Doc<"schoolClasses"> }) {
  const pathname = usePathname();
  const [imageError, setImageError] = useState(false);
  const imageSrc = imageError ? getRandomClassImage(`${cls._id}`) : cls.image;

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
            fill
            loading="eager"
            onError={() => setImageError(true)}
            preload
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            src={imageSrc}
            title={cls.name}
          />
        </div>
      </div>
      <CardContent className="space-y-2 px-6 pt-2 pb-4">
        <h2 className="truncate font-medium leading-tight tracking-tight">
          {cls.name}
        </h2>

        <div className="flex items-center gap-2 text-sm">
          <Badge className="min-w-0 shrink" variant="outline">
            <BookOpen className="size-4 shrink-0" />
            <span className="truncate">{cls.subject}</span>
          </Badge>
          <Badge className="min-w-0 shrink-0" variant="outline">
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">{cls.year}</span>
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="z-2 justify-end border-t px-4 pb-2 [.border-t]:pt-2">
        <Button asChild size="icon-sm" variant="ghost">
          <NavigationLink href={`${pathname}/${cls._id}/people`}>
            <UsersIcon />
          </NavigationLink>
        </Button>
        <Button size="icon-sm" variant="ghost">
          <EllipsisIcon />
        </Button>
      </CardFooter>
    </Card>
  );
}
