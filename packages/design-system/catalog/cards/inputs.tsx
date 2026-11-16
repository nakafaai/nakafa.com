import { Search02Icon, SentIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@repo/design-system/components/ui/input-group";

export const card = {
  name: "InputGroup",
  group: "Forms",
  height: 150,
  source: "components/ui/input-group",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex max-w-md flex-col gap-3 p-6">
      <InputGroup>
        <InputGroupAddon>
          <HugeIcons icon={Search02Icon} />
        </InputGroupAddon>
        <InputGroupInput aria-label="Search" placeholder="Search content..." />
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>nakafa.com/</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Handle"
          defaultValue="school/algebra"
          placeholder="school/class"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-sm" tooltip="Send">
            <HugeIcons icon={SentIcon} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
