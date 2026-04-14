"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
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
      <ButtonGroup>
        <Button onClick={() => setOpen(true)}>
          <HugeIcons icon={Add01Icon} />
          <span className="hidden sm:inline">{t("create-class")}</span>
        </Button>
      </ButtonGroup>

      <CreateSchoolClassDialog open={open} setOpenAction={setOpen} />
    </>
  );
}
