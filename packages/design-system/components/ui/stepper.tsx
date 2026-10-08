"use client";

import { useRender } from "@base-ui/react/use-render";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "cn";
import { Schema } from "effect";
import { createContext, use, useCallback, useMemo, useState } from "react";

const StepStateSchema = Schema.Literals([
  "active",
  "completed",
  "inactive",
  "loading",
]);

type StepState = typeof StepStateSchema.Type;

const StepItemContextValueSchema = Schema.Struct({
  isDisabled: Schema.Boolean,
  isLoading: Schema.Boolean,
  state: StepStateSchema,
  step: Schema.Finite,
});

type StepItemContextValue = typeof StepItemContextValueSchema.Type;

type StepperValueChange = (value: number) => void;

/** Builds the state a Stepper shares with its items and triggers. */
function useStepperValue(
  defaultValue: number,
  value: number | undefined,
  onValueChange: StepperValueChange | undefined
) {
  const [activeStep, setInternalStep] = useState(defaultValue);

  const setActiveStep = useCallback(
    (step: number) => {
      if (value === undefined) {
        setInternalStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange]
  );

  return useMemo(
    () => ({ activeStep: value ?? activeStep, setActiveStep }),
    [activeStep, setActiveStep, value]
  );
}

type StepperContextValue = ReturnType<typeof useStepperValue>;

const StepperContext = createContext<StepperContextValue | null>(null);
const StepItemContext = createContext<StepItemContextValue | null>(null);

/** Selects one part of the nearest Stepper state. */
function useStepper<T>(selector: (stepper: StepperContextValue) => T) {
  const value = use(StepperContext);
  if (!value) {
    throw new Error("useStepper must be used within a Stepper");
  }
  return selector(value);
}

/** Selects one part of the nearest StepperItem state. */
function useStepItem<T>(selector: (item: StepItemContextValue) => T) {
  const value = use(StepItemContext);
  if (!value) {
    throw new Error("useStepItem must be used within a StepperItem");
  }
  return selector(value);
}

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
  value?: number;
}

function Stepper({
  defaultValue = 0,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
  ...props
}: StepperProps) {
  const stepper = useStepperValue(defaultValue, value, onValueChange);

  return (
    <StepperContext value={stepper}>
      <div
        className={cn(
          "group/stepper inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
          className
        )}
        data-orientation={orientation}
        data-slot="stepper"
        {...props}
      />
    </StepperContext>
  );
}

interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  completed?: boolean;
  disabled?: boolean;
  loading?: boolean;
  step: number;
}

function StepperItem({
  step,
  completed = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const activeStep = useStepper((stepper) => stepper.activeStep);

  let state: StepState;
  if (completed || step < activeStep) {
    state = "completed";
  } else if (activeStep === step) {
    state = "active";
  } else {
    state = "inactive";
  }

  const isLoading = loading && step === activeStep;
  const item = useMemo(
    () => ({ isDisabled: disabled, isLoading, state, step }),
    [disabled, isLoading, state, step]
  );

  return (
    <StepItemContext value={item}>
      <div
        className={cn(
          "group/step flex items-center group-data-[orientation=horizontal]/stepper:flex-row group-data-[orientation=vertical]/stepper:flex-col",
          className
        )}
        data-slot="stepper-item"
        data-step-state={state}
        {...(isLoading ? { "data-loading": true } : {})}
        {...props}
      >
        {children}
      </div>
    </StepItemContext>
  );
}

function StepperTrigger({
  className,
  children,
  onClick,
  render,
  type,
  ...props
}: useRender.ComponentProps<"button">) {
  const setActiveStep = useStepper((stepper) => stepper.setActiveStep);
  const step = useStepItem((item) => item.step);
  const isDisabled = useStepItem((item) => item.isDisabled);

  return useRender({
    defaultTagName: "button",
    render,
    props: {
      children,
      className: cn(
        "inline-flex items-center gap-3 rounded-full outline-none focus-visible:z-10 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        className
      ),
      "data-slot": "stepper-trigger",
      disabled: isDisabled,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          setActiveStep(step);
        }
      },
      type: type ?? "button",
      ...props,
    },
  });
}

/** Renders the numbered, completed, or loading indicator content. */
function StepperDefaultIndicator() {
  const isLoading = useStepItem((item) => item.isLoading);
  const step = useStepItem((item) => item.step);

  return (
    <>
      <span className="transition-all group-data-[step-state=completed]/step:scale-0 group-data-loading/step:scale-0 group-data-[step-state=completed]/step:opacity-0 group-data-loading/step:opacity-0 group-data-loading/step:transition-none">
        {step}
      </span>
      <HugeIcons
        aria-hidden="true"
        className="absolute size-4 scale-0 opacity-0 transition-all group-data-[step-state=completed]/step:scale-100 group-data-[step-state=completed]/step:opacity-100"
        icon={Tick01Icon}
      />
      {isLoading ? (
        <span className="absolute transition-all">
          <Spinner aria-hidden="true" className="size-3.5" />
        </span>
      ) : null}
    </>
  );
}

function StepperIndicator({
  className,
  children,
  render,
  ...props
}: useRender.ComponentProps<"span">) {
  const state = useStepItem((item) => item.state);

  return useRender({
    defaultTagName: "span",
    render,
    props: {
      children: children ?? <StepperDefaultIndicator />,
      className: cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs data-[step-state=active]:bg-primary data-[step-state=completed]:bg-primary data-[step-state=active]:text-primary-foreground data-[step-state=completed]:text-primary-foreground",
        className
      ),
      "data-slot": "stepper-indicator",
      "data-step-state": state,
      ...props,
    },
  });
}

function StepperTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-medium text-sm", className)}
      data-slot="stepper-title"
      {...props}
    >
      {children}
    </h3>
  );
}

function StepperDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="stepper-description"
      {...props}
    />
  );
}

function StepperSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "m-0.5 bg-input group-data-[orientation=horizontal]/stepper:h-0.5 group-data-[orientation=vertical]/stepper:h-12 group-data-[orientation=horizontal]/stepper:w-full group-data-[orientation=vertical]/stepper:w-0.5 group-data-[orientation=horizontal]/stepper:flex-1 group-data-[step-state=completed]/step:bg-primary",
        className
      )}
      data-slot="stepper-separator"
      {...props}
    />
  );
}

export {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
};
