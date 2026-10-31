import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { gradeItems } from "@/components/tenant/settings/choices";

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

/** The school year of a cohort, one of the grades a cohort may hold, until one is chosen a placeholder. */
export function CohortGradeField({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (grade: string | null) => void;
  value: string | null;
}) {
  const t = useTranslations("SchoolSettings");

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("cohort-grade")}</FieldLabel>
      <Select items={gradeItems} onValueChange={onChange} value={value}>
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder={t("cohort-grade-placeholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Arr.map(gradeItems, (item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
