import {
  Cancel01Icon,
  File01Icon,
  Image01Icon,
} from "@hugeicons/core-free-icons";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@repo/design-system/components/ui/attachment";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export const card = {
  name: "Attachment",
  group: "Content",
  height: 180,
  source: "components/ui/attachment",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <AttachmentGroup>
        <Attachment className="max-w-64">
          <AttachmentMedia>
            <HugeIcons icon={File01Icon} />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>algebra.pdf</AttachmentTitle>
            <AttachmentDescription>application/pdf</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction tooltip="Remove algebra.pdf" variant="secondary">
              <HugeIcons icon={Cancel01Icon} />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
        <Attachment className="max-w-64" state="uploading">
          <AttachmentMedia>
            <HugeIcons icon={Image01Icon} />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>graph-sketch.png</AttachmentTitle>
            <AttachmentDescription>Uploading...</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
        <Attachment className="max-w-64" state="error">
          <AttachmentMedia>
            <HugeIcons icon={File01Icon} />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>notes.docx</AttachmentTitle>
            <AttachmentDescription>Upload failed</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      </AttachmentGroup>
    </div>
  );
}
