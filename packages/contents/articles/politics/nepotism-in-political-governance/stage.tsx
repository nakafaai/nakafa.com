import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@repo/design-system/components/ui/stepper";

type Props = {
  title: string;
  stages: {
    selection: string;
    election: string;
    delivery: string;
  };
};

export function Stage({ title, stages }: Props) {
  const stageList = [
    { step: 1, title: stages.selection },
    { step: 2, title: stages.election },
    { step: 3, title: stages.delivery },
  ];

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Stepper defaultValue={2}>
          {stageList.map((stage) => (
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
              {stage.step < stageList.length && (
                <StepperSeparator className="-order-1 -translate-y-1/2 absolute inset-x-0 top-3 left-[calc(50%+0.75rem+0.125rem)] m-0 group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none" />
              )}
            </StepperItem>
          ))}
        </Stepper>
      </CardContent>
    </Card>
  );
}
