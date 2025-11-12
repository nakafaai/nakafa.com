"use client";

import { cn } from "@repo/design-system/lib/tiptap-utils";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type React from "react";
import "@repo/design-system/components/tiptap-ui-primitive/dropdown-menu/dropdown-menu.scss";

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root modal={false} {...props} />;
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal {...props} />;
}

const DropdownMenuTrigger = ({
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger> & {
  ref?: React.Ref<React.ComponentRef<typeof DropdownMenuPrimitive.Trigger>>;
}) => <DropdownMenuPrimitive.Trigger ref={ref} {...props} />;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuItem = DropdownMenuPrimitive.Item;

const DropdownMenuSubTrigger = DropdownMenuPrimitive.SubTrigger;

const DropdownMenuSubContent = ({
  className,
  portal = true,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> & {
  portal?: boolean | React.ComponentProps<typeof DropdownMenuPortal>;
  ref?: React.Ref<React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>>;
}) => {
  const content = (
    <DropdownMenuPrimitive.SubContent
      className={cn("tiptap-dropdown-menu", className)}
      ref={ref}
      {...props}
    />
  );

  return portal ? (
    <DropdownMenuPortal {...(typeof portal === "object" ? portal : {})}>
      {content}
    </DropdownMenuPortal>
  ) : (
    content
  );
};

const DropdownMenuContent = ({
  className,
  sideOffset = 4,
  portal = false,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
  portal?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof DropdownMenuPrimitive.Content>>;
}) => {
  const content = (
    <DropdownMenuPrimitive.Content
      className={cn("tiptap-dropdown-menu", className)}
      onCloseAutoFocus={(e) => e.preventDefault()}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    />
  );

  return portal ? (
    <DropdownMenuPortal {...(typeof portal === "object" ? portal : {})}>
      {content}
    </DropdownMenuPortal>
  ) : (
    content
  );
};

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
