import { Add01Icon, FileAttachmentIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { InputGroupButton } from "@repo/design-system/components/ui/input-group";
import { useTranslations } from "next-intl";
import { type ComponentProps, memo } from "react";

/** Renders the attachment trigger menu while keeping input actions compact. */
export const InputAttachments = memo(
  ({
    onOpenFiles,
    ...props
  }: ComponentProps<typeof InputGroupButton> & {
    onOpenFiles: () => void;
  }) => {
    const t = useTranslations("School.Classes");

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <InputGroupButton
            size="icon"
            type="button"
            variant="ghost"
            {...props}
          >
            <HugeIcons icon={Add01Icon} />
            <span className="sr-only">{t("attachments")}</span>
          </InputGroupButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          <DropdownMenuItem className="cursor-pointer" onSelect={onOpenFiles}>
            <HugeIcons icon={FileAttachmentIcon} />
            {t("attachments")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
InputAttachments.displayName = "InputAttachments";
