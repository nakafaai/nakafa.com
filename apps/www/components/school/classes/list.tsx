"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { getRandomClassImage } from "@repo/backend/convex/classes/constants";
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
  const imageSrc =
    imageError || !cls.image ? getRandomClassImage(`${cls._id}`) : cls.image;

  return (
    <Card className="group relative gap-0 overflow-hidden p-0">
      <NavigationLink
        className="absolute inset-0 z-1"
        href={`${pathname}/${cls._id}`}
      />
      <div className="relative h-28 overflow-hidden border-b">
        <Image
          alt={cls.name}
          className="object-cover opacity-80 transition-opacity ease-out group-hover:opacity-100"
          fill
          loading="eager"
          onError={() => setImageError(true)}
          preload
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          src={imageSrc}
          title={cls.name}
        />
        <div className="absolute inset-0 flex items-center p-6">
          <div className="w-fit max-w-full rounded-sm border bg-card px-3 py-1.5 shadow-xs">
            <h2 className="truncate font-medium leading-tight tracking-tight">
              {cls.name}
            </h2>
          </div>
        </div>
      </div>
      <CardContent className="px-6 py-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <div className="flex min-w-0 items-center gap-1.5">
            <BookOpen className="size-4 shrink-0" />
            <span className="truncate">{cls.subject}</span>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">{cls.year}</span>
          </div>
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
