import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller";
import { Array as Arr } from "effect";

const turns = [
  { id: "q1", role: "user", text: "What is a quadratic function?" },
  {
    id: "a1",
    role: "nina",
    text: "A function of the form f(x) = ax² + bx + c with a ≠ 0. Its graph is a parabola.",
  },
  { id: "q2", role: "user", text: "How do I know if it opens up or down?" },
  {
    id: "a2",
    role: "nina",
    text: "Look at a. When a is positive the parabola opens upward, and when a is negative it opens downward.",
  },
  { id: "q3", role: "user", text: "And the axis of symmetry?" },
  {
    id: "a3",
    role: "nina",
    text: "It is the vertical line x = -b / 2a, which also passes through the vertex.",
  },
];

export const card = {
  name: "MessageScroller",
  group: "Chat",
  height: 320,
  source: "scroller",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="relative flex h-80 min-w-0 flex-col overflow-hidden">
      <MessageScrollerPrimitive.Provider
        autoScroll
        defaultScrollPosition="last-anchor"
      >
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Messages">
            <MessageScrollerContent className="p-6">
              {Arr.map(turns, (turn) => (
                <MessageScrollerItem
                  key={turn.id}
                  messageId={turn.id}
                  scrollAnchor={turn.role === "user"}
                >
                  {turn.role === "user" ? (
                    <Message align="end">
                      <MessageContent>
                        <Bubble variant="muted">
                          <BubbleContent>{turn.text}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  ) : (
                    <Message>
                      <MessageContent>
                        <p className="text-sm">{turn.text}</p>
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton label="Jump to the latest message" />
        </MessageScroller>
      </MessageScrollerPrimitive.Provider>
    </div>
  );
}
