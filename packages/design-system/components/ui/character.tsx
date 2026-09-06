"use client";

import { cn } from "@repo/design-system/lib/utils";
import Avatar, { genConfig } from "react-nice-avatar";

interface Props {
  className?: string;
  name: string;
}

export function Character({ name, className }: Props) {
  const config = genConfig(name);

  return <Avatar {...config} className={cn("shrink-0 border", className)} />;
}
