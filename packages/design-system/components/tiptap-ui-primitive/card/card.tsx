"use client";

import { cn } from "@repo/design-system/lib/tiptap-utils";
import type React from "react";
import "@repo/design-system/components/tiptap-ui-primitive/card/card.scss";

const Card = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div className={cn("tiptap-card", className)} ref={ref} {...props} />
);

const CardHeader = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div className={cn("tiptap-card-header", className)} ref={ref} {...props} />
);

const CardBody = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div className={cn("tiptap-card-body", className)} ref={ref} {...props} />
);

const CardItemGroup = ({
  className,
  orientation = "vertical",
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
  ref?: React.Ref<HTMLDivElement>;
}) => (
  <div
    className={cn("tiptap-card-item-group", className)}
    data-orientation={orientation}
    ref={ref}
    {...props}
  />
);

const CardGroupLabel = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div
    className={cn("tiptap-card-group-label", className)}
    ref={ref}
    {...props}
  />
);

const CardFooter = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div className={cn("tiptap-card-footer", className)} ref={ref} {...props} />
);

export {
  Card,
  CardHeader,
  CardFooter,
  CardBody,
  CardItemGroup,
  CardGroupLabel,
};
