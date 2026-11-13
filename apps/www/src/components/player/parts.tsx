import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Picker,
  PickerContent,
  PickerItem,
  PickerTrigger,
} from "@repo/design-system/components/ui/picker";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";

/**
 * The parts of a paper at the top of its pane, such as the sub-subjects of a try-out set, as a searchable picker
 * whose face names the part on screen. A paper of one part shows none. A running simulation keeps the learner in
 * its part, so it offers the others without letting them open.
 */
export function PlayerParts<
  Part extends { readonly key: string; readonly label: string },
>({
  current,
  iconOf,
  locked,
  onChoose,
  parts,
}: {
  /** The key of the part on screen. */
  current: string;
  /** The icon of a part, the one the paper's page shows for it. */
  iconOf: (part: Part) => ComponentProps<typeof HugeIcons>["icon"];
  /** Whether the paper holds the learner in the part on screen. */
  locked: boolean;
  onChoose: (part: Part) => void;
  parts: readonly Part[];
}) {
  const t = useTranslations("Player");
  const shown = Arr.findFirst(parts, (part) => part.key === current);

  if (parts.length < 2 || Option.isNone(shown)) {
    return null;
  }

  return (
    <Picker>
      <PickerTrigger
        render={
          <Button
            className="w-full justify-between"
            data-player-parts=""
            type="button"
            variant="outline"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <HugeIcons icon={iconOf(shown.value)} />
          <span className="truncate" dir="auto">
            {shown.value.label}
          </span>
        </span>
        <HugeIcons icon={ArrowDown01Icon} />
      </PickerTrigger>
      <PickerContent
        empty={t("parts-empty")}
        items={parts}
        itemToStringValue={(part) => part.label}
        label={t("menu-parts")}
        placeholder={t("parts-search")}
      >
        {(part) => (
          <PickerItem
            disabled={locked && part.key !== current}
            icon={iconOf(part)}
            key={part.key}
            onClick={() => onChoose(part)}
            selected={part.key === current}
            value={part}
          >
            <span className="truncate" dir="auto">
              {part.label}
            </span>
          </PickerItem>
        )}
      </PickerContent>
    </Picker>
  );
}
