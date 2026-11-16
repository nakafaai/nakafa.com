import {
  ArrowDown01Icon,
  Copy01Icon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export const card = {
  name: "ButtonGroup",
  group: "Actions",
  height: 120,
  source: "button-group",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-wrap items-center gap-6 p-6">
      <ButtonGroup>
        <Button>
          <HugeIcons icon={Copy01Icon} />
          Copy link
        </Button>
        <Button size="icon" tooltip="Share">
          <HugeIcons icon={Share08Icon} />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <ButtonGroupText>Grade</ButtonGroupText>
        <Button>
          10
          <HugeIcons icon={ArrowDown01Icon} />
        </Button>
      </ButtonGroup>
      <Button>Save</Button>
    </div>
  );
}
