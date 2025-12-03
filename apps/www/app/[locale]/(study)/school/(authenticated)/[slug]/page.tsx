"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { redirect } from "next/navigation";

export default function Page() {
  const pathname = usePathname();

  redirect(`${pathname}/dashboard`);
}
