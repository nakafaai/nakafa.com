import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";

export const card = {
  name: "Checkbox",
  group: "Forms",
  height: 120,
  source: "components/ui/checkbox",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Label>
        <Checkbox defaultChecked />
        Show worked solutions
      </Label>
      <Label>
        <Checkbox />
        Email me when a Tryout opens
      </Label>
      <Label>
        <Checkbox disabled />
        Disabled
      </Label>
    </div>
  );
}
