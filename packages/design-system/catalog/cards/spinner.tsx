import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";

export const card = {
  name: "Spinner",
  group: "Feedback",
  height: 110,
  source: "components/ui/spinner",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex items-center gap-6 p-6">
      <Spinner aria-label="Loading" className="size-4" />
      <Button disabled>
        <Spinner aria-label="Saving" />
        Saving
      </Button>
    </div>
  );
}
