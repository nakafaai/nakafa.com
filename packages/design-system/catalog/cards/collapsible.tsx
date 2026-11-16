import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export const card = {
  name: "Collapsible",
  group: "Content",
  height: 200,
  source: "components/ui/collapsible",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="max-w-md p-6">
      <Collapsible defaultOpen>
        <CollapsibleTrigger render={<Button variant="outline" />}>
          Show worked solution
          <HugeIcons icon={ArrowDown01Icon} />
        </CollapsibleTrigger>
        <CollapsiblePanel className="mt-3 rounded-md border p-4 text-sm">
          Factor the expression, set each factor to zero, then check both roots
          in the original equation.
        </CollapsiblePanel>
      </Collapsible>
    </div>
  );
}
