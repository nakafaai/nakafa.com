"use client";

import { cn } from "@repo/design-system/lib/utils";
import type { CSSProperties } from "react";
import Avatar, { genConfig } from "react-nice-avatar";

interface Props {
  className?: string;
  name: string;
  style?: CSSProperties;
}

export function Character({ name, className, style }: Props) {
  const config = genConfig(name);

  return (
    <Avatar
      {...config}
      className={cn("shrink-0 border", className)}
      style={{ ...style }}
    />
  );
}
