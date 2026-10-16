import { AttachmentGroup } from "@repo/design-system/components/ui/attachment";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import {
  MessageContent,
  MessageFooter,
} from "@repo/design-system/components/ui/message";
import type { FileUIPart } from "ai";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { NinaAttachment } from "@/components/ai/attachment";
import { NinaWords } from "@/components/ai/message/words.client";

/**
 * The same prompt geometry before admission, during navigation and in history,
 * on streamed surfaces and static pages alike. The learner's `text` is shown
 * as they wrote it, whichever surface asks: this is the one place that decides
 * how.
 *
 * Its files sit in a row that starts at the first file and scrolls to the
 * rest. The row is as wide as its files and as far to the end as the message
 * is, so it needs no alignment of its own: a row that is wider than the
 * column fills it, and one that is aligned to the end would push its first
 * files past the start edge, where no scrolling reaches.
 */
export function NinaPrompt({
  actions,
  files = [],
  text,
}: {
  actions?: ReactNode;
  files?: readonly FileUIPart[];
  text: string;
}) {
  return (
    <MessageContent>
      {files.length > 0 ? (
        <AttachmentGroup className="max-w-full">
          {Arr.map(files, (file) => (
            <NinaAttachment file={file} key={file.url} />
          ))}
        </AttachmentGroup>
      ) : null}
      <Bubble variant="muted">
        <BubbleContent>
          <NinaWords>{text}</NinaWords>
        </BubbleContent>
      </Bubble>
      <MessageFooter className="h-9">{actions}</MessageFooter>
    </MessageContent>
  );
}
