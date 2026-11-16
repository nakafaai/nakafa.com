import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@repo/design-system/components/ui/stepper";
import { Array as Arr } from "effect";

const steps = [
  { step: 1, title: "Register" },
  { step: 2, title: "Tryout" },
  { step: 3, title: "Review" },
  { step: 4, title: "Results" },
];

export const card = {
  name: "Stepper",
  group: "Navigation",
  height: 150,
  source: "stepper",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="p-6">
      <Stepper defaultValue={2}>
        {Arr.map(steps, ({ step, title }) => (
          <StepperItem className="not-last:flex-1" key={step} step={step}>
            <StepperTrigger className="gap-2">
              <StepperIndicator />
              <StepperTitle>{title}</StepperTitle>
            </StepperTrigger>
            {step < steps.length && <StepperSeparator />}
          </StepperItem>
        ))}
      </Stepper>
    </div>
  );
}
