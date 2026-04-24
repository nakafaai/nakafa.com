"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { CreateAssessmentDialog } from "@/components/school/classes/assessments/create-dialog";
import { SchoolClassesAssessmentsSearch } from "@/components/school/classes/assessments/search";
import { useClassPermissions } from "@/lib/hooks/use-class-permissions";

/** Render the assessments page header actions. */
export function SchoolClassesAssessmentsHeader() {
  return (
    <ButtonGroup className="w-full">
      <SchoolClassesAssessmentsSearch />
      <SchoolClassesAssessmentsHeaderAction />
    </ButtonGroup>
  );
}

function SchoolClassesAssessmentsHeaderAction() {
  const t = useTranslations("School.Classes");
  const { can } = useClassPermissions();
  const [open, openHandlers] = useDisclosure(false);

  if (!can(PERMISSIONS.ASSESSMENT_CREATE)) {
    return null;
  }

  return (
    <div>
      <Button onClick={openHandlers.open}>
        <HugeIcons icon={Add01Icon} />
        {t("create-assessment")}
      </Button>

      <CreateAssessmentDialog open={open} setOpenAction={openHandlers.set} />
    </div>
  );
}
