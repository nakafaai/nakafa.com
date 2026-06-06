"use client";

import { cn } from "@repo/design-system/lib/utils";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  type Transition,
} from "motion/react";
import * as React from "react";

const MS_TO_S = 1000;
const AUTO_ITEM_KEY_PREFIX = "highlight-item";

type HighlightMode = "children" | "parent";

interface Bounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface HighlightContextType<T extends string> {
  activeClassName?: string;
  activeValue: T | null;
  as?: keyof HTMLElementTagNameMap;
  className?: string;
  clearBounds: () => void;
  click: boolean;
  disabled?: boolean;
  enabled?: boolean;
  exitDelay?: number;
  forceUpdateBounds?: boolean;
  hover: boolean;
  id: string;
  mode: HighlightMode;
  setActiveClassName: (className: string) => void;
  setActiveValue: (value: T | null) => void;
  setBounds: (bounds: DOMRect) => void;
  style?: React.CSSProperties;
  transition?: Transition;
}

const HighlightContext = React.createContext<
  HighlightContextType<string> | undefined
>(undefined);

/** Reads highlight state from the nearest Highlight provider. */
function useHighlight<T extends string>(): HighlightContextType<T> {
  const context = React.use(HighlightContext);
  if (!context) {
    throw new Error("useHighlight must be used within a HighlightProvider");
  }
  return context as unknown as HighlightContextType<T>;
}

interface BaseHighlightProps<T extends React.ElementType = "div"> {
  as?: T;
  className?: string;
  click?: boolean;
  defaultValue?: string | null;
  disabled?: boolean;
  enabled?: boolean;
  exitDelay?: number;
  hover?: boolean;
  mode?: HighlightMode;
  onValueChange?: (value: string | null) => void;
  ref?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  transition?: Transition;
  value?: string | null;
}

interface ParentModeHighlightProps {
  boundsOffset?: Partial<Bounds>;
  containerClassName?: string;
  forceUpdateBounds?: boolean;
}

type ControlledParentModeHighlightProps<T extends React.ElementType = "div"> =
  BaseHighlightProps<T> &
    ParentModeHighlightProps & {
      mode: "parent";
      controlledItems: true;
      children: React.ReactNode;
    };

type ControlledChildrenModeHighlightProps<T extends React.ElementType = "div"> =
  BaseHighlightProps<T> & {
    mode?: "children" | undefined;
    controlledItems: true;
    children: React.ReactNode;
  };

type UncontrolledParentModeHighlightProps<T extends React.ElementType = "div"> =
  BaseHighlightProps<T> &
    ParentModeHighlightProps & {
      mode: "parent";
      controlledItems?: false;
      itemsClassName?: string;
      children: React.ReactElement | React.ReactElement[];
    };

type UncontrolledChildrenModeHighlightProps<
  T extends React.ElementType = "div",
> = BaseHighlightProps<T> & {
  mode?: "children";
  controlledItems?: false;
  itemsClassName?: string;
  children: React.ReactElement | React.ReactElement[];
};

type HighlightProps<T extends React.ElementType = "div"> =
  | ControlledParentModeHighlightProps<T>
  | ControlledChildrenModeHighlightProps<T>
  | UncontrolledParentModeHighlightProps<T>
  | UncontrolledChildrenModeHighlightProps<T>;

function Highlight<T extends React.ElementType = "div">({
  ref,
  ...props
}: HighlightProps<T>) {
  const {
    as: Component = "div",
    children,
    value,
    defaultValue,
    onValueChange,
    className,
    style,
    transition = { type: "spring", stiffness: 350, damping: 35 },
    hover = false,
    click = true,
    enabled = true,
    controlledItems,
    disabled = false,
    exitDelay = 200,
    mode = "children",
  } = props;

  const localRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

  const [uncontrolledActiveValue, setUncontrolledActiveValue] = React.useState<
    string | null
  >(defaultValue ?? null);
  const activeValue = value === undefined ? uncontrolledActiveValue : value;
  const [boundsState, setBoundsState] = React.useState<Bounds | null>(null);
  const [activeClassNameState, setActiveClassNameState] =
    React.useState<string>("");

  const safeSetActiveValue = React.useCallback(
    (newId: string | null) => {
      if (value === undefined) {
        setUncontrolledActiveValue((prev) => (prev === newId ? prev : newId));
      }

      if (newId !== activeValue) {
        onValueChange?.(newId);
      }
    },
    [activeValue, onValueChange, value]
  );

  const boundsOffsetProp = (props as ParentModeHighlightProps)?.boundsOffset;

  const safeSetBounds = React.useCallback(
    (bounds: DOMRect) => {
      if (!localRef.current) {
        return;
      }

      const boundsOffset = boundsOffsetProp ?? {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      };

      const containerRect = localRef.current.getBoundingClientRect();
      const newBounds: Bounds = {
        top: bounds.top - containerRect.top + (boundsOffset.top ?? 0),
        left: bounds.left - containerRect.left + (boundsOffset.left ?? 0),
        width: bounds.width + (boundsOffset.width ?? 0),
        height: bounds.height + (boundsOffset.height ?? 0),
      };

      setBoundsState((prev) => {
        if (
          prev &&
          prev.top === newBounds.top &&
          prev.left === newBounds.left &&
          prev.width === newBounds.width &&
          prev.height === newBounds.height
        ) {
          return prev;
        }
        return newBounds;
      });
    },
    [boundsOffsetProp]
  );

  const clearBounds = React.useCallback(() => {
    setBoundsState((prev) => (prev === null ? prev : null));
  }, []);

  const id = React.useId();

  const syncBoundsOnScroll = React.useEffectEvent(
    (container: HTMLDivElement) => {
      if (!activeValue) {
        return;
      }

      const activeEl = container.querySelector<HTMLElement>(
        `[data-value="${activeValue}"][data-highlight="true"]`
      );

      if (activeEl) {
        safeSetBounds(activeEl.getBoundingClientRect());
      }
    }
  );

  React.useEffect(() => {
    if (mode !== "parent") {
      return;
    }
    const container = localRef.current;
    if (!container) {
      return;
    }

    const onScroll = () => syncBoundsOnScroll(container);

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [mode]);

  const containerClassName = (props as ParentModeHighlightProps)
    ?.containerClassName;
  const forceUpdateBounds = (props as ParentModeHighlightProps)
    ?.forceUpdateBounds;

  const render = React.useCallback(
    (renderChildren: React.ReactNode) => {
      if (mode === "parent") {
        return React.createElement(
          Component,
          {
            className: containerClassName,
            "data-slot": "motion-highlight-container",
            ref: localRef,
            style: { position: "relative", zIndex: 1 },
          },
          <>
            <AnimatePresence initial={false} mode="wait">
              {!!boundsState && (
                <m.div
                  animate={{
                    top: boundsState.top,
                    left: boundsState.left,
                    width: boundsState.width,
                    height: boundsState.height,
                    opacity: 1,
                  }}
                  className={cn(className, activeClassNameState)}
                  data-slot="motion-highlight"
                  exit={{
                    opacity: 0,
                    transition: {
                      ...transition,
                      delay:
                        (transition?.delay ?? 0) + (exitDelay ?? 0) / MS_TO_S,
                    },
                  }}
                  initial={{
                    top: boundsState.top,
                    left: boundsState.left,
                    width: boundsState.width,
                    height: boundsState.height,
                    opacity: 0,
                  }}
                  style={{ position: "absolute", zIndex: 0, ...style }}
                  transition={transition}
                />
              )}
            </AnimatePresence>
            {renderChildren}
          </>
        );
      }

      return renderChildren;
    },
    [
      mode,
      Component,
      containerClassName,
      boundsState,
      transition,
      exitDelay,
      style,
      className,
      activeClassNameState,
    ]
  );
  const contextValue = React.useMemo(
    () => ({
      mode,
      activeValue,
      setActiveValue: safeSetActiveValue,
      id,
      hover,
      click,
      className,
      style,
      transition,
      disabled,
      enabled,
      exitDelay,
      setBounds: safeSetBounds,
      clearBounds,
      activeClassName: activeClassNameState,
      setActiveClassName: setActiveClassNameState,
      forceUpdateBounds,
    }),
    [
      mode,
      activeValue,
      safeSetActiveValue,
      id,
      hover,
      click,
      className,
      style,
      transition,
      disabled,
      enabled,
      exitDelay,
      safeSetBounds,
      clearBounds,
      activeClassNameState,
      forceUpdateBounds,
    ]
  );

  return (
    <HighlightContext.Provider value={contextValue}>
      <LazyMotion features={domAnimation} strict>
        {(() => {
          if (!enabled) {
            return children;
          }
          if (controlledItems) {
            return render(children);
          }
          return render(
            React.Children.map(children, (child, index) => {
              let childKey: string;
              if (React.isValidElement(child) && child.key) {
                childKey = child.key;
              } else if (
                React.isValidElement(child) &&
                (child.props as { id?: string }).id
              ) {
                childKey = (child.props as { id?: string }).id as string;
              } else {
                childKey = `${AUTO_ITEM_KEY_PREFIX}-${index}`;
              }
              return (
                <HighlightItem className={props?.itemsClassName} key={childKey}>
                  {child}
                </HighlightItem>
              );
            })
          );
        })()}
      </LazyMotion>
    </HighlightContext.Provider>
  );
}

function getNonOverridingDataAttributes(
  element: React.ReactElement,
  dataAttributes: Record<string, unknown>
): Record<string, unknown> {
  return Object.keys(dataAttributes).reduce<Record<string, unknown>>(
    (acc, key) => {
      if ((element.props as Record<string, unknown>)[key] === undefined) {
        acc[key] = dataAttributes[key];
      }
      return acc;
    },
    {}
  );
}

type ExtendedChildProps = React.ComponentProps<"div"> & {
  id?: string;
  ref?: React.Ref<HTMLElement>;
  "data-active"?: string;
  "data-value"?: string;
  "data-disabled"?: boolean;
  "data-highlight"?: boolean;
  "data-slot"?: string;
};

type HighlightItemProps<T extends React.ElementType = "div"> =
  React.ComponentProps<T> & {
    as?: T;
    children: React.ReactElement;
    id?: string;
    value?: string;
    className?: string;
    style?: React.CSSProperties;
    transition?: Transition;
    activeClassName?: string;
    disabled?: boolean;
    exitDelay?: number;
    asChild?: boolean;
    forceUpdateBounds?: boolean;
  };

function HighlightItem<T extends React.ElementType>({
  ref,
  as,
  children,
  id,
  value,
  className,
  style,
  transition,
  disabled = false,
  activeClassName,
  exitDelay,
  asChild = false,
  forceUpdateBounds,
  ...props
}: HighlightItemProps<T>) {
  const itemId = React.useId();
  const {
    activeValue,
    setActiveValue,
    mode,
    setBounds,
    clearBounds,
    hover,
    click,
    enabled,
    className: contextClassName,
    style: contextStyle,
    transition: contextTransition,
    id: contextId,
    disabled: contextDisabled,
    exitDelay: contextExitDelay,
    forceUpdateBounds: contextForceUpdateBounds,
    setActiveClassName,
  } = useHighlight();

  const Component = as ?? "div";
  const element = children as React.ReactElement<ExtendedChildProps>;
  const childValue =
    id ?? value ?? element.props?.["data-value"] ?? element.props?.id ?? itemId;
  const isActive = activeValue === childValue;
  const isDisabled = disabled === undefined ? contextDisabled : disabled;
  const itemTransition = transition ?? contextTransition;

  const localRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

  React.useEffect(() => {
    if (mode !== "parent") {
      return;
    }
    let rafId: number;
    let previousBounds: Bounds | null = null;
    const shouldUpdateBounds =
      forceUpdateBounds === true ||
      (contextForceUpdateBounds && forceUpdateBounds !== false);

    const updateBounds = () => {
      if (!localRef.current) {
        return;
      }

      const bounds = localRef.current.getBoundingClientRect();

      if (shouldUpdateBounds) {
        if (
          previousBounds &&
          previousBounds.top === bounds.top &&
          previousBounds.left === bounds.left &&
          previousBounds.width === bounds.width &&
          previousBounds.height === bounds.height
        ) {
          rafId = requestAnimationFrame(updateBounds);
          return;
        }
        previousBounds = bounds;
        rafId = requestAnimationFrame(updateBounds);
      }

      setBounds(bounds);
    };

    if (isActive) {
      updateBounds();
      setActiveClassName(activeClassName ?? "");
    } else if (!activeValue) {
      clearBounds();
    }

    if (shouldUpdateBounds) {
      return () => cancelAnimationFrame(rafId);
    }
  }, [
    mode,
    isActive,
    activeValue,
    setBounds,
    clearBounds,
    activeClassName,
    setActiveClassName,
    forceUpdateBounds,
    contextForceUpdateBounds,
  ]);

  if (!React.isValidElement(children)) {
    return children;
  }

  const dataAttributes = {
    "data-active": isActive ? "true" : "false",
    "aria-selected": isActive,
    "data-disabled": isDisabled,
    "data-value": childValue,
    "data-highlight": true,
  };

  let commonHandlers = {};
  if (hover) {
    commonHandlers = {
      onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
        setActiveValue(childValue);
        element.props.onMouseEnter?.(e);
      },
      onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
        setActiveValue(null);
        element.props.onMouseLeave?.(e);
      },
    };
  } else if (click) {
    commonHandlers = {
      onClick: (e: React.MouseEvent<HTMLDivElement>) => {
        setActiveValue(childValue);
        element.props.onClick?.(e);
      },
    };
  }

  if (asChild) {
    if (mode === "children") {
      return React.cloneElement(
        element,
        {
          key: childValue,
          ref: localRef,
          className: cn("relative", element.props.className),
          ...getNonOverridingDataAttributes(element, {
            ...dataAttributes,
            "data-slot": "motion-highlight-item-container",
          }),
          ...commonHandlers,
          ...props,
        },
        <>
          <AnimatePresence initial={false} mode="wait">
            {!!isActive && !isDisabled && (
              <m.div
                animate={{ opacity: 1 }}
                className={cn(contextClassName, activeClassName)}
                data-slot="motion-highlight"
                exit={{
                  opacity: 0,
                  transition: {
                    ...itemTransition,
                    delay:
                      (itemTransition?.delay ?? 0) +
                      (exitDelay ?? contextExitDelay ?? 0) / MS_TO_S,
                  },
                }}
                initial={{ opacity: 0 }}
                layoutId={`transition-background-${contextId}`}
                style={{
                  position: "absolute",
                  zIndex: 0,
                  ...contextStyle,
                  ...style,
                }}
                transition={itemTransition}
                {...dataAttributes}
              />
            )}
          </AnimatePresence>

          <Component
            className={className}
            data-slot="motion-highlight-item"
            style={{ position: "relative", zIndex: 1 }}
            {...dataAttributes}
          >
            {children}
          </Component>
        </>
      );
    }

    return React.cloneElement(element, {
      ref: localRef,
      ...getNonOverridingDataAttributes(element, {
        ...dataAttributes,
        "data-slot": "motion-highlight-item",
      }),
      ...commonHandlers,
    });
  }

  return enabled ? (
    <Component
      className={cn(mode === "children" && "relative", className)}
      data-slot="motion-highlight-item-container"
      key={childValue}
      ref={localRef}
      {...dataAttributes}
      {...props}
      {...commonHandlers}
    >
      {mode === "children" && (
        <AnimatePresence initial={false} mode="wait">
          {!!isActive && !isDisabled && (
            <m.div
              animate={{ opacity: 1 }}
              className={cn(contextClassName, activeClassName)}
              data-slot="motion-highlight"
              exit={{
                opacity: 0,
                transition: {
                  ...itemTransition,
                  delay:
                    (itemTransition?.delay ?? 0) +
                    (exitDelay ?? contextExitDelay ?? 0) / MS_TO_S,
                },
              }}
              initial={{ opacity: 0 }}
              layoutId={`transition-background-${contextId}`}
              style={{
                position: "absolute",
                zIndex: 0,
                ...contextStyle,
                ...style,
              }}
              transition={itemTransition}
              {...dataAttributes}
            />
          )}
        </AnimatePresence>
      )}

      {React.cloneElement(element, {
        style: { position: "relative", zIndex: 1 },
        className: element.props.className,
        ...getNonOverridingDataAttributes(element, {
          ...dataAttributes,
          "data-slot": "motion-highlight-item",
        }),
      })}
    </Component>
  ) : (
    children
  );
}

export {
  Highlight,
  HighlightItem,
  type HighlightItemProps,
  type HighlightProps,
  useHighlight,
};
