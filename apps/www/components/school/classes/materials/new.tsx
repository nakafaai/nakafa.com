"use client";

import { FolderAddIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useClass } from "@/lib/context/use-class";
import { MaterialGroupEditorDialog } from "./editor-dialog";
import type { MaterialGroupFormValues } from "./schema";
import { getDefaultScheduledAt } from "./utils";

const defaultValues: MaterialGroupFormValues = {
  name: "",
  description: "",
  status: "published",
  scheduledAt: getDefaultScheduledAt(),
};

/** Render the create-material-group entry point for one class. */
export function SchoolClassesMaterialsNew() {
  const t = useTranslations("School.Classes");
  const classId = useClass((c) => c.class._id);
  const [openDialog, setOpenDialog] = useState(false);
  const createMaterial = useMutation(
    api.classes.materials.mutations.createMaterialGroup
  );

  return (
    <ButtonGroup>
      <Button onClick={() => setOpenDialog(true)}>
        <HugeIcons icon={FolderAddIcon} />
        {t("new-module")}
      </Button>

      <MaterialGroupEditorDialog
        defaultValues={defaultValues}
        description={t("new-module-description")}
        errorContext={{ source: "school-material-group-create" }}
        errorMessage={t("create-material-group-failed")}
        formId="school-classes-materials-new-form"
        onSubmit={async (value) => {
          await createMaterial({
            ...value,
            classId,
            scheduledAt:
              value.status === "scheduled" ? value.scheduledAt : undefined,
          });
        }}
        open={openDialog}
        setOpen={setOpenDialog}
        submitLabel={t("create")}
        title={t("new-module-title")}
      />
    </ButtonGroup>
  );
}
