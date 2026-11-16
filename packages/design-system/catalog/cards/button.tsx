import {
  ArrowRight01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export const card = {
  name: "Button",
  group: "Actions",
  height: 120,
  source: "components/ui/button",
};

/** The page's one primary action, the outlined actions beside it, the quiet and destructive ones, and an icon button. */
export function Preview() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <Button>
        Start learning
        <HugeIcons icon={ArrowRight01Icon} />
      </Button>
      <Button variant="outline">View exams</Button>
      <Button variant="secondary">Try Nakafa</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">
        <HugeIcons icon={Delete02Icon} />
        Delete account
      </Button>
      <Button size="icon" tooltip="More actions" variant="outline">
        <HugeIcons icon={MoreHorizontalIcon} />
      </Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}
