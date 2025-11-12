"use client";

import {
  autoUpdate,
  FloatingDelayGroup,
  FloatingPortal,
  flip,
  offset,
  type Placement,
  type ReferenceType,
  shift,
  type UseFloatingReturn,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
} from "@floating-ui/react";
import type React from "react";
import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useState,
  version,
} from "react";
import "@repo/design-system/components/tiptap-ui-primitive/tooltip/tooltip.scss";

type TooltipProviderProps = {
  children: React.ReactNode;
  initialOpen?: boolean;
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  delay?: number;
  closeDelay?: number;
  timeout?: number;
  useDelayGroup?: boolean;
};

interface TooltipTriggerProps
  extends Omit<React.HTMLProps<HTMLElement>, "ref"> {
  asChild?: boolean;
  children: React.ReactNode;
}

interface TooltipContentProps
  extends Omit<React.HTMLProps<HTMLDivElement>, "ref"> {
  children?: React.ReactNode;
  portal?: boolean;
  portalProps?: Omit<React.ComponentProps<typeof FloatingPortal>, "children">;
}

interface TooltipContextValue extends UseFloatingReturn<ReferenceType> {
  open: boolean;
  setOpen: (open: boolean) => void;
  getReferenceProps: (
    userProps?: React.HTMLProps<HTMLElement>
  ) => Record<string, unknown>;
  getFloatingProps: (
    userProps?: React.HTMLProps<HTMLDivElement>
  ) => Record<string, unknown>;
}

function useTooltip({
  initialOpen = false,
  placement = "top",
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  delay = 600,
  closeDelay = 0,
}: Omit<TooltipProviderProps, "children"> = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] =
    useState<boolean>(initialOpen);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({
        crossAxis: placement.includes("-"),
        fallbackAxisSideDirection: "start",
        padding: 4,
      }),
      shift({ padding: 4 }),
    ],
  });

  const context = data.context;

  const hover = useHover(context, {
    mouseOnly: true,
    move: false,
    restMs: delay,
    enabled: controlledOpen == null,
    delay: {
      close: closeDelay,
    },
  });
  const focus = useFocus(context, {
    enabled: controlledOpen == null,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const interactions = useInteractions([hover, focus, dismiss, role]);

  return useMemo(
    () => ({
      open,
      setOpen,
      ...interactions,
      ...data,
    }),
    [open, setOpen, interactions, data]
  );
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltipContext() {
  const context = useContext(TooltipContext);

  if (context == null) {
    throw new Error(
      "Tooltip components must be wrapped in <TooltipProvider />"
    );
  }

  return context;
}

export function Tooltip({ children, ...props }: TooltipProviderProps) {
  const tooltip = useTooltip(props);

  if (!props.useDelayGroup) {
    return (
      <TooltipContext.Provider value={tooltip}>
        {children}
      </TooltipContext.Provider>
    );
  }

  return (
    <FloatingDelayGroup
      delay={{ open: props.delay ?? 0, close: props.closeDelay ?? 0 }}
      timeoutMs={props.timeout}
    >
      <TooltipContext.Provider value={tooltip}>
        {children}
      </TooltipContext.Provider>
    </FloatingDelayGroup>
  );
}

export const TooltipTrigger = ({
  children,
  asChild = false,
  ref: propRef,
  ...props
}: TooltipTriggerProps & { ref?: React.Ref<HTMLElement> }) => {
  const context = useTooltipContext();
  let childrenRef: React.Ref<HTMLElement> | undefined;
  if (isValidElement(children)) {
    if (Number.parseInt(version, 10) >= 19) {
      const elementWithProps = children as {
        props: { ref?: React.Ref<HTMLElement> };
      };
      childrenRef = elementWithProps.props.ref;
    } else {
      const elementWithRef = children as { ref?: React.Ref<HTMLElement> };
      childrenRef = elementWithRef.ref;
    }
  }
  const ref = useMergeRefs([context.refs.setReference, propRef, childrenRef]);

  if (asChild && isValidElement(children)) {
    const dataAttributes = {
      "data-tooltip-state": context.open ? "open" : "closed",
    };

    return cloneElement(
      children,
      context.getReferenceProps({
        ref,
        ...props,
        ...(typeof children.props === "object" ? children.props : {}),
        ...dataAttributes,
      })
    );
  }

  return (
    <button
      data-tooltip-state={context.open ? "open" : "closed"}
      ref={ref}
      {...context.getReferenceProps(props)}
    >
      {children}
    </button>
  );
};

export const TooltipContent = ({
  style,
  children,
  portal = true,
  portalProps = {},
  ref: propRef,
  ...props
}: TooltipContentProps & { ref?: React.Ref<HTMLDivElement> }) => {
  const context = useTooltipContext();
  const ref = useMergeRefs([context.refs.setFloating, propRef]);

  if (!context.open) {
    return null;
  }

  const content = (
    <div
      ref={ref}
      style={{
        ...context.floatingStyles,
        ...style,
      }}
      {...context.getFloatingProps(props)}
      className="tiptap-tooltip"
    >
      {children}
    </div>
  );

  if (portal) {
    return <FloatingPortal {...portalProps}>{content}</FloatingPortal>;
  }

  return content;
};

Tooltip.displayName = "Tooltip";
