"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CreateSchoolClassDialog } from "./header-add-dialog";

/** Render the class-creation entry point inside the school classes header. */
export function SchoolClassesHeaderAdd() {
  const t = useTranslations("School.Classes");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        <HugeIcons icon={Add01Icon} />
        <span className="hidden sm:inline">{t("create-class")}</span>
      </Button>

      <CreateSchoolClassDialog open={open} setOpenAction={setOpen} />
    </>
  );
}
