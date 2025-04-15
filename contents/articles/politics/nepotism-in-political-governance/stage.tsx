import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper";
import { useTranslations } from "next-intl";

type Props = {
  title: string;
};

export function Stage({ title }: Props) {
  const t = useTranslations("Common");

  const stages = [
    { step: 1, title: t("selection") },
    { step: 2, title: t("election") },
    { step: 3, title: t("delivery") },
  ];

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Stepper defaultValue={2}>
          {stages.map((stage) => (
            <StepperItem
              key={stage.step}
              step={stage.step}
              className="relative flex-1 flex-col!"
            >
              <StepperTrigger className="flex-col gap-3 rounded">
                <StepperIndicator />
                <div className="space-y-0.5 px-2">
                  <StepperTitle>{stage.title}</StepperTitle>
                </div>
              </StepperTrigger>
              {stage.step < stages.length && (
                <StepperSeparator className="-order-1 -translate-y-1/2 absolute inset-x-0 top-3 left-[calc(50%+0.75rem+0.125rem)] m-0 group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none" />
              )}
            </StepperItem>
          ))}
        </Stepper>
      </CardContent>
    </Card>
  );
}
