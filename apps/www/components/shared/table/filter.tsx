import { Input } from "@repo/design-system/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Array as Arr } from "effect";

/**
 * A toggle group that filters a table by one column's value: one item for each choice, which shows its
 * label and holds its value, with the chosen value pressed. The caller reads the chosen value, so the
 * filter stays a plain control.
 */
export function TableToggle({
  choices,
  label,
  onChange,
  value,
}: {
  readonly choices: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      gridColumns="auto"
      onValueChange={onChange}
      value={value}
      variant="outline"
    >
      {Arr.map(choices, (choice) => (
        <ToggleGroupItem key={choice.value} value={choice.value}>
          {choice.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** The search box that filters a table's rows by their text, such as a student's name. */
export function TableSearch({
  label,
  onChange,
  placeholder,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly value: string;
}) {
  return (
    <Input
      aria-label={label}
      className="sm:max-w-64"
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  );
}
