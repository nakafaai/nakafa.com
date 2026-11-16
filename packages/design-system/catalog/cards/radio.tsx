import { Label } from "@repo/design-system/components/ui/label";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";

export const card = {
  name: "RadioGroup",
  group: "Forms",
  height: 140,
  source: "radio-group",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="p-6">
      <RadioGroup aria-label="Role" defaultValue="student">
        <Label>
          <Radio value="student" />
          Student
        </Label>
        <Label>
          <Radio value="teacher" />
          Teacher
        </Label>
        <Label>
          <Radio value="parent" />
          Parent
        </Label>
      </RadioGroup>
    </div>
  );
}
