import { Clock01Icon } from "@hugeicons/core-free-icons";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { ChoiceLabel } from "@/components/tenant/choice";

/**
 * How long a room runs, as the dialogs that schedule and move a room ask for it: the lengths it offers in minutes, each
 * with the clock, under the list's one-word label.
 */
export function RoomLengthField({
  id,
  lengths,
  minutes,
  onChange,
}: {
  id: string;
  /** The lengths offered, in minutes. */
  lengths: readonly number[];
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const t = useTranslations("Exams");
  const items = Arr.map(lengths, (length) => ({
    label: t("length-minutes", { count: length }),
    value: `${length}`,
  }));

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("length")}</FieldLabel>
      <Select
        items={items}
        onValueChange={(value) => {
          const next = Arr.findFirst(
            lengths,
            (length) => `${length}` === value
          );
          if (Option.isSome(next)) {
            onChange(next.value);
          }
        }}
        value={`${minutes}`}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <ChoiceLabel name="length" />
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} value={item.value}>
                <HugeIcons icon={Clock01Icon} />
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
