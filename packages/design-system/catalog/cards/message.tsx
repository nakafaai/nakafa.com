import { Copy01Icon, ThumbsUpIcon } from "@hugeicons/core-free-icons";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@repo/design-system/components/ui/message";

export const card = {
  name: "Message",
  group: "Chat",
  height: 300,
  source: "message",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Message align="end">
        <MessageContent>
          <Bubble variant="muted">
            <BubbleContent>
              How do I find the vertex of y = x² - 4x + 3?
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message>
        <MessageContent>
          <p className="text-sm">
            Complete the square: y = (x - 2)² - 1, so the vertex is at (2, -1).
            The parabola opens upward because the x² coefficient is positive.
          </p>
          <MessageFooter>
            <Button size="icon-sm" tooltip="Copy answer" variant="ghost">
              <HugeIcons icon={Copy01Icon} />
            </Button>
            <Button size="icon-sm" tooltip="Helpful" variant="ghost">
              <HugeIcons icon={ThumbsUpIcon} />
            </Button>
          </MessageFooter>
        </MessageContent>
      </Message>
    </div>
  );
}
