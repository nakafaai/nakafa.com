import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr } from "effect";
import { useId } from "react";

/** A labelled choice of a settings form: the items it offers, and the value chosen. */
export function SelectField({
  items,
  label,
  onChoose,
  value,
}: {
  items: readonly { readonly label: string; readonly value: string }[];
  label: string;
  onChoose: (value: string) => void;
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
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Arr.map(items, (item) => (
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
