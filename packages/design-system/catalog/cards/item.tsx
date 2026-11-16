import {
  ArrowRight01Icon,
  BookOpen01Icon,
  Calculator01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";

export const card = {
  name: "Item",
  group: "Content",
  height: 220,
  source: "components/ui/item",
};

/** Rows of a list: the icon of each row's kind, a title and one line under it, and the row's action at its end. */
export function Preview() {
  return (
    <div className="max-w-md p-6">
      <ItemGroup>
        <Item render={<li />} variant="outline">
          <ItemMedia variant="icon">
            <HugeIcons icon={BookOpen01Icon} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Quadratic functions</ItemTitle>
            <ItemDescription>Grade 10 mathematics</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="icon-sm" tooltip="Open lesson" variant="ghost">
              <HugeIcons icon={ArrowRight01Icon} />
            </Button>
          </ItemActions>
        </Item>
        <Item render={<li />} variant="outline">
          <ItemMedia variant="icon">
            <HugeIcons icon={Calculator01Icon} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Linear equations</ItemTitle>
            <ItemDescription>Grade 10 mathematics</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="icon-sm" tooltip="Open lesson" variant="ghost">
              <HugeIcons icon={ArrowRight01Icon} />
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  );
}
