"use client";

import { Link } from "@/i18n/routing";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";

export default function NavigationLink({
  href,
  ...props
}: ComponentProps<typeof Link>) {
  const selectedLayoutSegment = useSelectedLayoutSegment();
  const pathname = selectedLayoutSegment ? `/${selectedLayoutSegment}` : "/";
  const isActive = pathname === href;

  return (
    <Link aria-current={isActive ? "page" : undefined} href={href} {...props} />
  );
}
