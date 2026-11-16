import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";

export const card = {
  name: "NumberField",
  group: "Forms",
  height: 150,
  source: "components/ui/number",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex max-w-xs flex-col gap-4 p-6">
      <Field>
        <FieldLabel htmlFor="points">Points</FieldLabel>
        <NumberField defaultValue={4} id="points" max={100} min={1}>
          <NumberFieldGroup className="w-36">
            <NumberFieldDecrement />
            <NumberFieldInput placeholder="1" />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
      </Field>
    </div>
  );
}
