import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import { useState } from "react";

export const card = {
  name: "ResponsiveDialog",
  group: "Overlays",
  height: 360,
  source: "responsive-dialog",
};

/** A confirm: the title and its sentence, a body that shows what the action takes away, then Cancel beside it. */
export function Preview() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)} variant="outline">
        Leave class
      </Button>
      <ResponsiveDialog
        action={
          <Button onClick={() => setOpen(false)} variant="destructive">
            Leave class
          </Button>
        }
        description="You can join again later with the class code."
        open={open}
        setOpen={setOpen}
        title="Leave this class?"
      >
        <ResponsiveDialogSubject description="32 learners" icon={UserGroupIcon}>
          Algebra 10A
        </ResponsiveDialogSubject>
      </ResponsiveDialog>
    </div>
  );
}
