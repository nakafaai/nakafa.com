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
import { Array as Arr } from "effect";
import { type ComponentProps, useId } from "react";
import { ChoiceLabel } from "@/components/tenant/choice";

/**
 * A labelled choice of a settings form: the items it offers, each with the icon of its kind, and the value chosen. Its
 * list opens with the one word that names what is chosen (`choice`), and a field with nothing chosen yet shows what to
 * choose (`placeholder`), so the trigger is never blank.
 */
export function SelectField({
  choice,
  items,
  label,
  onChoose,
  placeholder,
  value,
}: {
  choice: ComponentProps<typeof ChoiceLabel>["name"];
  items: readonly {
    readonly icon: ComponentProps<typeof HugeIcons>["icon"];
    readonly label: string;
    readonly value: string;
  }[];
  label: string;
  onChoose: (value: string) => void;
  placeholder?: string;
  value: string | null;
}) {
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        onValueChange={(next) => {
          if (typeof next === "string") {
            onChoose(next);
          }
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <ChoiceLabel name={choice} />
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} value={item.value}>
                <HugeIcons icon={item.icon} />
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
