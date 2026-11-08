import {
  Add01Icon,
  ChartBarLineIcon,
  File02Icon,
  Image01Icon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { InputGroupButton } from "@repo/design-system/components/ui/input-group";
import { Array as Arr } from "effect";
import { useRef } from "react";
import { useTranslations } from "use-intl";
import { IconTip } from "@/components/tenant/classes/forum/tip";
import { DOCUMENT_ACCEPT } from "@/components/tenant/classes/forum/tray";

/**
 * Add, at the start of the composer: a photo or a document from the device's own picker, and a poll where the place
 * takes one, a channel and never a thread. The chosen files go to `onFiles`, and the picker empties for the next pick.
 */
export function AttachMenu({
  onFiles,
  onPoll,
}: {
  onFiles: (files: readonly File[]) => void;
  /** Opens a new poll, where the place takes one. */
  onPoll: (() => void) | undefined;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const photos = useRef<HTMLInputElement>(null);
  const documents = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        accept="image/*"
        aria-hidden="true"
        className="hidden"
        multiple
        onChange={(event) => {
          onFiles(Arr.fromIterable(event.target.files ?? []));
          event.target.value = "";
        }}
        ref={photos}
        tabIndex={-1}
        type="file"
      />
      <input
        accept={DOCUMENT_ACCEPT}
        aria-hidden="true"
        className="hidden"
        multiple
        onChange={(event) => {
          onFiles(Arr.fromIterable(event.target.files ?? []));
          event.target.value = "";
        }}
        ref={documents}
        tabIndex={-1}
        type="file"
      />
      <DropdownMenu>
        <IconTip label={t("attach-add")}>
          <DropdownMenuTrigger
            render={
              <InputGroupButton
                aria-label={t("attach-add")}
                className="rounded-full"
                size="icon"
                variant="ghost"
              />
            }
          >
            <HugeIcons icon={Add01Icon} />
          </DropdownMenuTrigger>
        </IconTip>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{common("menu-attach")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => photos.current?.click()}>
              <HugeIcons icon={Image01Icon} />
              {t("attach-photo")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => documents.current?.click()}>
              <HugeIcons icon={File02Icon} />
              {t("attach-document")}
            </DropdownMenuItem>
            {onPoll === undefined ? null : (
              <DropdownMenuItem onClick={onPoll}>
                <HugeIcons icon={ChartBarLineIcon} />
                {t("attach-poll")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
