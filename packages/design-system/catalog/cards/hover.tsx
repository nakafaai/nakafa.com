import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/design-system/components/ui/hover-card";
import { Nina } from "@repo/design-system/components/ui/nina";

export const card = {
  name: "HoverCard",
  group: "Overlays",
  height: 220,
  source: "components/ui/hover-card",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex justify-center p-6">
      <HoverCard defaultOpen>
        <HoverCardTrigger
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          href="#"
        >
          Nina
        </HoverCardTrigger>
        <HoverCardContent className="w-72">
          <div className="flex gap-3">
            <Nina label="" lean="center" size={40} tile="blue" />
            <div className="grid gap-1 text-sm">
              <p className="font-medium">Nina</p>
              <p className="text-muted-foreground">
                Answers from Nakafa lessons.
              </p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
