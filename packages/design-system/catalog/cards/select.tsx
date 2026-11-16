import { SchoolIcon } from "@hugeicons/core-free-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";

const grades = [
  { label: "Grade 10", value: "10" },
  { label: "Grade 11", value: "11" },
  { label: "Grade 12", value: "12" },
];

export const card = {
  name: "Select",
  group: "Forms",
  height: 260,
  source: "select",
};

/** A short choice: the list opens with its one-word label, and every option shows the icon of its kind. */
export function Preview() {
  const t = useTranslations("Common");
  return (
    <div className="flex gap-4 p-6">
      <Select defaultOpen defaultValue="11" items={grades}>
        <SelectTrigger aria-label={t("menu-grade")} className="w-48">
          <SelectValue placeholder="Select a grade" />
        </SelectTrigger>
        <SelectContent label={t("menu-grade")}>
          {Arr.map(grades, (grade) => (
            <SelectItem icon={SchoolIcon} key={grade.value} value={grade.value}>
              {grade.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
