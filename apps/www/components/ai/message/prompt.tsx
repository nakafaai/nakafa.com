import { AttachmentGroup } from "@repo/design-system/components/ui/attachment";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import {
  MessageContent,
  MessageFooter,
} from "@repo/design-system/components/ui/message";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { NinaAttachment, type NinaFile } from "@/components/ai/attachment";

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
  files?: readonly NinaFile[];
}) {
  return (
    <MessageContent>
      {files.length > 0 ? (
        // Files that fit sit at the end of the row, beside the bubble; files
        // wider than the row start at its start, where its scroll reaches them.
        <AttachmentGroup className="justify-end-safe max-w-full">
          {Arr.map(files, (file) => (
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
