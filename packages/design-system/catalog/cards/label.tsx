import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";

export const card = {
  name: "Label",
  group: "Forms",
  height: 150,
  source: "components/ui/label",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex max-w-sm flex-col gap-4 p-6">
      <div className="grid gap-2">
        <Label htmlFor="label-country">Country</Label>
        <Input id="label-country" placeholder="Indonesia" />
      </div>
      <Label>
        <Checkbox defaultChecked />
        Remember my grade
      </Label>
    </div>
  );
}
