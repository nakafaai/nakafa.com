import { Copy01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export const card = {
  name: "Tooltip",
  group: "Overlays",
  height: 120,
  source: "tooltip",
};

/** An icon button names its action in words: its `tooltip` shows on hover and focus and is read as its name. */
export function Preview() {
  return (
    <div className="flex justify-center p-6 pt-12">
      <Button size="icon" tooltip="Copy link" variant="outline">
        <HugeIcons icon={Copy01Icon} />
      </Button>
    </div>
  );
}
