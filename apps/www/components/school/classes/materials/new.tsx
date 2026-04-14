"use client";

import { FolderAddIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CreateMaterialGroupDialog } from "./editor-dialog";

/** Render the create-material-group entry point for one class. */
export function SchoolClassesMaterialsNew() {
  const t = useTranslations("School.Classes");
  const [openDialog, setOpenDialog] = useState(false);

  return (
    <ButtonGroup>
      <Button onClick={() => setOpenDialog(true)}>
        <HugeIcons icon={FolderAddIcon} />
        {t("new-module")}
      </Button>

      <CreateMaterialGroupDialog
        open={openDialog}
        setOpenAction={setOpenDialog}
      />
    </ButtonGroup>
  );
}
