import { Add01Icon, FileAttachmentIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

/** Renders the attachment trigger menu while keeping input actions compact. */
export const InputAttachments = ({
  onOpenFiles,
  ...props
}: ComponentProps<typeof Button> & {
  onOpenFiles: () => void;
}) => {
  const t = useTranslations("School.Classes");

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button size="icon" type="button" variant="ghost" {...props}>
            <HugeIcons icon={Add01Icon} />
            <span className="sr-only">{t("attachments")}</span>
          </Button>
        }
      />

      <MenuPopup align="start">
        <MenuItem className="cursor-pointer" onClick={onOpenFiles}>
          <HugeIcons icon={FileAttachmentIcon} />
          {t("attachments")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
};
InputAttachments.displayName = "InputAttachments";
