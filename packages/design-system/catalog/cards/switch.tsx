import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";

export const card = {
  name: "Switch",
  group: "Forms",
  height: 200,
  source: "components/ui/switch",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="grid gap-5 p-6 text-sm">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="switch-remember">Remember my progress</Label>
        <Switch defaultChecked id="switch-remember" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="switch-profile">Show my profile to classmates</Label>
        <Switch id="switch-profile" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="switch-managed">Managed by your school</Label>
        <Switch defaultChecked disabled id="switch-managed" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="switch-locked">Turned off by your school</Label>
        <Switch disabled id="switch-locked" />
      </div>
    </div>
  );
}
