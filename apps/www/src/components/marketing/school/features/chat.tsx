import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useRoom } from "@/components/marketing/school/features/scope";
import { AttachMenu } from "@/components/tenant/classes/forum/attach";
import {
  EmojiPopover,
  EmojiTrigger,
} from "@/components/tenant/classes/forum/chooser";

/**
 * The forum's composer under the demo chat, as a class's member writes: the attach menu, the field,
 * the emoji chooser and Send. What the reader sends lands in the open chat as their own message, on the
 * forum's own-message bubble, and a file they attach lands by its name; nothing leaves the page.
 */
export function ForumChat() {
  const t = useTranslations("Classroom");
  const tEmoji = useTranslations("Emoji");
  const [text, setText] = useState("");
  const post = useRoom((state) => state.post);

  return (
    <form
      className="flex w-full min-w-0 shrink-0 flex-col gap-2 px-2 pb-3 sm:px-4 sm:pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = text.trim();
        if (trimmed === "") {
          return;
        }
        post(trimmed);
        setText("");
      }}
    >
      <InputGroup className="bg-muted/50 text-chat rounded-3xl shadow-none">
        <InputGroupAddon align="inline-start" className="self-end pb-1.5">
          <AttachMenu
            onFiles={(files) => Arr.forEach(files, (file) => post(file.name))}
            onPoll={undefined}
          />
        </InputGroupAddon>
        <InputGroupTextarea
          aria-label={t("message-placeholder")}
          className="max-h-[min(12rem,35dvh)] min-h-11 py-3 ps-1"
          dir="auto"
          onChange={(event) => setText(event.target.value)}
          placeholder={t("message-placeholder")}
          value={text}
        />
        <InputGroupAddon align="inline-end" className="self-end pb-1.5">
          <EmojiPopover
            onPick={(emoji) => setText((current) => `${current}${emoji}`)}
            side="top"
          >
            <EmojiTrigger
              render={
                <InputGroupButton
                  className="rounded-full"
                  size="icon"
                  tooltip={tEmoji("open")}
                  variant="ghost"
                />
              }
            />
          </EmojiPopover>
          <InputGroupButton
            className="rounded-full"
            disabled={text.trim() === ""}
            size="icon"
            tooltip={t("send-message")}
            type="submit"
            variant="secondary"
          >
            <HugeIcons icon={ArrowUp02Icon} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
