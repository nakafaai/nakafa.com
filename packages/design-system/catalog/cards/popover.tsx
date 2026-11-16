import { Copy01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";

export const card = {
  name: "Popover",
  group: "Overlays",
  height: 260,
  source: "components/ui/popover",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex justify-center p-6">
      <Popover defaultOpen>
        <PopoverTrigger render={<Button variant="outline" />}>
          Share lesson
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <PopoverHeader>
            <PopoverTitle>Share this lesson</PopoverTitle>
            <PopoverDescription>
              Anyone with the link can read it.
            </PopoverDescription>
          </PopoverHeader>
          <div className="flex gap-2">
            <Input
              aria-label="Lesson link"
              defaultValue="nakafa.com/en/subject/high-school/10/mathematics"
              placeholder="Lesson link"
              readOnly
            />
            <Button size="icon" tooltip="Copy link" variant="outline">
              <HugeIcons icon={Copy01Icon} />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
