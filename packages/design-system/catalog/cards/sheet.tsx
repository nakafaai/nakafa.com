import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";

export const card = {
  name: "Sheet",
  group: "Overlays",
  height: 380,
  source: "components/ui/sheet",
};

/** The card's live example. */
export function Preview() {
  return (
    <Sheet defaultOpen>
      <SheetPopup side="right">
        <SheetHeader>
          <SheetTitle>Lesson outline</SheetTitle>
          <SheetDescription>
            Jump to any section of this lesson.
          </SheetDescription>
        </SheetHeader>
        <ol className="grid gap-2 px-4 text-sm">
          <li>Definition</li>
          <li>Graph of a quadratic function</li>
          <li>Vertex form</li>
          <li>Exercises</li>
        </ol>
        <SheetFooter>
          <p className="text-muted-foreground text-sm">
            Four sections, about 12 minutes.
          </p>
          <Button>Start reading</Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
