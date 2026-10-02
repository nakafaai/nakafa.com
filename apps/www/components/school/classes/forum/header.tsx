"use client";

import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { useTranslations } from "next-intl";
import { SchoolClassesForumNew } from "@/components/school/classes/forum/new";
import { SchoolClassesSearch } from "@/components/school/classes/search";

export function SchoolClassesForumHeader() {
  const t = useTranslations("School.Classes");

  return (
    <ButtonGroup className="w-full">
      <SchoolClassesSearch placeholder={t("forum-search-placeholder")} />
      <SchoolClassesForumNew />
    </ButtonGroup>
  );
}
