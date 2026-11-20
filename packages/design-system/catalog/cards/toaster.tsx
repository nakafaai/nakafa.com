import { Toaster } from "@repo/design-system/components/ui/toast";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useEffect } from "react";

const persistent = { duration: Number.POSITIVE_INFINITY };

export const card = {
  name: "Toaster",
  group: "Feedback",
  height: 300,
  source: "components/ui/toast",
};

/** Toasts of each kind, kept open: a success, a failure that says what to do, and a notice. */
export function Preview() {
  useEffect(() => {
    toast.info(
      { title: "offline-move.title", description: "offline-move.description" },
      persistent
    );
    toast.error(
      {
        title: "image-refused-size.title",
        description: "image-refused-size.description",
      },
      persistent
    );
    toast.success({ title: "school-address-copied.title" }, persistent);
  }, []);
  return <Toaster />;
}
