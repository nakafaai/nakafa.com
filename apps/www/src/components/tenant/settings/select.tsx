import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr } from "effect";
import { type ComponentProps, useId } from "react";

/**
 * A labelled choice of a settings form: the items it offers, each with the icon of its kind, and the value chosen. Its
 * list opens with the one word that names what is chosen (`menu`), and a field with nothing chosen yet shows what to
 * choose (`placeholder`), so the trigger is never blank.
 */
export function SelectField({
  items,
  label,
  menu,
  onChoose,
  placeholder,
  value,
}: {
  items: readonly {
    readonly icon: ComponentProps<typeof HugeIcons>["icon"];
    readonly label: string;
    readonly value: string;
  }[];
  label: string;
  /** The one word, read from a `menu-` key, that names what is chosen. */
  menu: string;
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
        <SelectContent label={menu}>
          {Arr.map(items, (item) => (
            <SelectItem icon={item.icon} key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
