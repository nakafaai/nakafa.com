"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { usePaginatedQuery } from "convex/react";
import { GraduationCapIcon, SpeechIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useClass } from "@/lib/context/use-class";
import { searchParsers } from "@/lib/nuqs/search";
import { getInitialName } from "@/lib/utils/helper";

const DEBOUNCE_TIME = 500;

export function SchoolClassesPeopleList() {
  const t = useTranslations("School.Classes");

  const classId = useClass((state) => state.class._id);
  const [{ q }] = useQueryStates(searchParsers);

  const [debouncedQ] = useDebouncedValue(q, DEBOUNCE_TIME);

  const { results, status } = usePaginatedQuery(
    api.classes.queries.getPeople,
    {
      classId,
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
          {t("no-people-found")}
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
      {results.map((person) => (
        <article
          className="flex items-center justify-between gap-4 p-4"
          key={person._id}
        >
          <div className="flex flex-1 items-center gap-2">
            <Avatar>
              <AvatarImage
                alt={person.user.name}
                src={person.user.image ?? ""}
              />
              <AvatarFallback>
                {getInitialName(person.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <p className="truncate font-medium text-foreground">
                {person.user.name}
              </p>
              <span className="truncate text-muted-foreground">
                {person.user.email}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {person.role === "teacher" ? (
                <SpeechIcon />
              ) : (
                <GraduationCapIcon />
              )}
              {t(person.role)}
            </Badge>
          </div>
        </article>
      ))}
    </section>
  );
}
