import { ArrowDown01Icon, Book02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Picker,
  PickerContent,
  PickerItem,
  PickerTrigger,
} from "@repo/design-system/components/ui/picker";
import { useTranslations } from "use-intl";

const subjects = ["Merdeka", "KSSM", "Cambridge", "IB", "Abitur"];

export const card = {
  name: "Picker",
  group: "Forms",
  height: 360,
  source: "picker",
};

/** A searchable choice: the search over the options in a popover on a wide screen, in a drawer on a phone. */
export function Preview() {
  const t = useTranslations("Common");
  return (
    <div className="p-6">
      <Picker defaultOpen>
        <PickerTrigger
          render={<Button className="w-56 justify-between" variant="outline" />}
        >
          Merdeka
          <HugeIcons icon={ArrowDown01Icon} />
        </PickerTrigger>
        <PickerContent
          empty={t("popup-empty")}
          items={subjects}
          itemToStringValue={(subject) => subject}
          label={t("menu-curriculum")}
          placeholder="Search curricula"
        >
          {(subject) => (
            <PickerItem
              icon={Book02Icon}
              key={subject}
              selected={subject === "Merdeka"}
              value={subject}
            >
              {subject}
            </PickerItem>
          )}
        </PickerContent>
      </Picker>
    </div>
  );
}
