import { ArrowUp02Icon, AttachmentIcon } from "@hugeicons/core-free-icons";
import {
  PromptInput,
  PromptInputTextarea,
} from "@repo/design-system/components/ai/input";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@repo/design-system/components/ui/input-group";

export const card = {
  name: "PromptInput",
  group: "Chat",
  height: 200,
  source: "components/ai/input",
};

/** The composer a learner asks Nina in: the field, then attach and send at its foot. */
export function Preview() {
  return (
    <div className="max-w-xl p-6">
      <PromptInput fileInputLabel="Attach files" onSubmit={() => false}>
        <InputGroup className="bg-muted/50 rounded-3xl shadow-none">
          <PromptInputTextarea
            aria-label="Ask Nina"
            className="px-3 py-3"
            placeholder="Ask Nina anything"
          />
          <InputGroupAddon
            align="block-end"
            className="justify-between gap-2 pb-3"
          >
            <InputGroupButton size="icon-sm" tooltip="Attach files">
              <HugeIcons icon={AttachmentIcon} />
            </InputGroupButton>
            <InputGroupButton size="icon-sm" tooltip="Send" variant="default">
              <HugeIcons icon={ArrowUp02Icon} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PromptInput>
    </div>
  );
}
