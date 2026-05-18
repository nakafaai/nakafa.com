import { routing } from "@repo/internationalization/src/routing";
import { createNavigation } from "next-intl/navigation";

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
