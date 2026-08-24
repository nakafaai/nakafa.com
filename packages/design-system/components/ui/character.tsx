"use client";

import { cn } from "@repo/design-system/lib/utils";
import {
  Children,
  type CSSProperties,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
} from "react";
import Avatar, { genConfig } from "react-nice-avatar";

interface Props {
  className?: string;
  name: string;
  style?: CSSProperties;
}

interface AvatarElementProps {
  children?: ReactNode;
  clipPath?: unknown;
  id?: unknown;
  mask?: unknown;
}

function scopeFragmentReference(value: unknown, prefix: string) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replaceAll("url(#", `url(#${prefix}-`);
}

function scopeAvatarElement(
  element: ReactElement<AvatarElementProps>,
  prefix: string
): ReactElement<AvatarElementProps> {
  const { children, clipPath, id, mask } = element.props;
  const scopedChildren = Children.map(children, (child) => {
    if (!isValidElement<AvatarElementProps>(child)) {
      return child;
    }

    return scopeAvatarElement(child, prefix);
  });

  return cloneElement(
    element,
    {
      clipPath: scopeFragmentReference(clipPath, prefix),
      id: typeof id === "string" ? `${prefix}-${id}` : id,
      mask: scopeFragmentReference(mask, prefix),
    },
    scopedChildren
  );
}

class ScopedAvatar extends Avatar {
  override render() {
    const avatar = super.render();
    const prefix = this.props.id;

    if (!(prefix && isValidElement<AvatarElementProps>(avatar))) {
      return avatar;
    }

    const scopedChildren = Children.map(avatar.props.children, (child) => {
      if (!isValidElement<AvatarElementProps>(child)) {
        return child;
      }

      return scopeAvatarElement(child, prefix);
    });

    return cloneElement(avatar, undefined, scopedChildren);
  }
}

export function Character({ name, className, style }: Props) {
  const config = genConfig(name);
  const avatarId = `character-${useId().replaceAll(":", "")}`;

  return (
    <ScopedAvatar
      {...config}
      className={cn("shrink-0 border", className)}
      id={avatarId}
      style={{ ...style }}
    />
  );
}
