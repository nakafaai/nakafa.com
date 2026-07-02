"use client";

import { useDisclosure } from "@mantine/hooks";
import { CreateSchoolClassDialog } from "@/components/school/classes/add/dialog";

/** Render the class-creation entry point inside the school classes header. */
export function SchoolClassesHeaderAdd() {
  const [open, openHandlers] = useDisclosure(false);

  return (
    <CreateSchoolClassDialog open={open} setOpenAction={openHandlers.set} />
  );
}
