import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@repo/design-system/components/progress/stepper";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import type { ReactNode } from "react";

interface Props {
  labels: {
    delivery: ReactNode;
    election: ReactNode;
    selection: ReactNode;
  };
  title: ReactNode;
}

export function Stage({ title, labels }: Props) {
  const stages = [
    { step: 1, title: labels.selection },
    { step: 2, title: labels.election },
    { step: 3, title: labels.delivery },
  ];

  return (
    <Frame className="mb-4 content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
      </FrameHeader>
      <FramePanel>
        <Stepper defaultValue={2}>
          {stages.map((stage) => (
            <StepperItem
              className="relative flex-1 flex-col!"
              key={stage.step}
              step={stage.step}
            >
              <StepperTrigger className="flex-col gap-3 rounded">
                <StepperIndicator />
                <div className="space-y-0.5 px-2">
                  <StepperTitle>{stage.title}</StepperTitle>
                </div>
              </StepperTrigger>
              {stage.step < stages.length && (
                <StepperSeparator className="absolute inset-x-0 top-3 left-[calc(50%+0.75rem+0.125rem)] -order-1 m-0 -translate-y-1/2 group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none" />
              )}
            </StepperItem>
          ))}
        </Stepper>
      </FramePanel>
    </Frame>
  );
}
