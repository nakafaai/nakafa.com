"use client";

import { FolderAddIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { CreateMaterialGroupDialog } from "./editor-dialog";

/** Render the create-material-group entry point for one class. */
export function SchoolClassesMaterialsNew() {
  const t = useTranslations("School.Classes");
  const [openDialog, openDialogHandlers] = useDisclosure(false);

  return (
    <div>
      <Button onClick={openDialogHandlers.open} type="button">
        <HugeIcons icon={FolderAddIcon} />
        {t("new-module")}
      </Button>

      <CreateMaterialGroupDialog
        open={openDialog}
        setOpenAction={openDialogHandlers.set}
      />
    </div>
  );
}
