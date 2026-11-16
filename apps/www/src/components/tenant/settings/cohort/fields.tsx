import { Mortarboard01Icon } from "@hugeicons/core-free-icons";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { gradeItemsOf } from "@/components/tenant/settings/choices";
import { CohortLevelContext } from "@/components/tenant/settings/cohort/level";

/** The name of a cohort, as the dialogs that add and edit one ask for it. */
export function CohortNameField({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (name: string) => void;
  value: string;
}) {
  const t = useTranslations("SchoolSettings");

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("cohort-name")}</FieldLabel>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("cohort-name-placeholder")}
        value={value}
      />
    </Field>
  );
}

/**
 * The school year of a cohort, one of the grades its unit's level teaches, until one is chosen a placeholder. The
 * cohorts page provides the level of the unit it shows.
 */
export function CohortGradeField({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (grade: string | null) => void;
  value: string | null;
}) {
  const common = useTranslations("Common");
  const t = useTranslations("SchoolSettings");
  const level = useRequired(CohortLevelContext, "CohortGradeField");
  const gradeItems = gradeItemsOf(level);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("cohort-grade")}</FieldLabel>
      <Select items={gradeItems} onValueChange={onChange} value={value}>
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder={t("cohort-grade-placeholder")} />
        </SelectTrigger>
        <SelectContent label={common("menu-grade")}>
          {Arr.map(gradeItems, (item) => (
            <SelectItem
              icon={Mortarboard01Icon}
              key={item.value}
              value={item.value}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
