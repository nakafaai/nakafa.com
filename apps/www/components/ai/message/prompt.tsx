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
import type { ReactNode } from "react";
import { NinaAttachment } from "@/components/ai/attachment";

/**
 * The same prompt geometry before admission, during navigation and in history.
 * Streamed surfaces pass `Response`; static server pages pass `MarkdownContent`.
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
        <AttachmentGroup className="max-w-full justify-end">
          {files.map((file) => (
            <NinaAttachment file={file} key={file.url} />
          ))}
        </AttachmentGroup>
      ) : null}
      <Bubble variant="muted">
        <BubbleContent>{children}</BubbleContent>
      </Bubble>
      <MessageFooter className="h-9">{actions}</MessageFooter>
    </MessageContent>
  );
}
