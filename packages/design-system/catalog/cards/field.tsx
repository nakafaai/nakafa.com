import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";

export const card = {
  name: "Field",
  group: "Forms",
  height: 320,
  source: "field",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="max-w-md p-6">
      <FieldSet>
        <FieldLegend>Profile</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="field-name">Name</FieldLabel>
            <Input id="field-name" placeholder="Your name" />
            <FieldDescription>
              Shown to your class and in the forum.
            </FieldDescription>
          </Field>
          <Field data-invalid>
            <FieldLabel htmlFor="field-code">Class code</FieldLabel>
            <Input
              aria-invalid
              defaultValue="ABC"
              id="field-code"
              placeholder="Six characters"
            />
            <FieldError>Class codes have six characters.</FieldError>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  );
}
