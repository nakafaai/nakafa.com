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
 * on streamed surfaces and static pages alike. Its children are the learner's
 * words as Markdown: `LearnerText` from a server component, which sends no
 * JavaScript, or `DeferredLearnerText` from a client component, which loads
 * the Markdown pipeline only once a prompt is drawn.
 *
 * Its files sit in a row that starts at the first file and scrolls to the
 * rest. The row is as wide as its files and as far to the end as the message
 * is, so it needs no alignment of its own: a row that is wider than the
 * column fills it, and one that is aligned to the end would push its first
 * files past the start edge, where no scrolling reaches.
 */
export function NinaPrompt({
  actions,
  children,
  files = [],
}: {
  actions?: ReactNode;
  children: ReactNode;
  files?: readonly FileUIPart[];
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
          <NinaWords>{children}</NinaWords>
        </BubbleContent>
      </Bubble>
      <MessageFooter className="h-9">{actions}</MessageFooter>
    </MessageContent>
  );
}
