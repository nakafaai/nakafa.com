import { TenantHome } from "@/components/tenant/home";

/**
 * Beranda of a school host, rendered inside the school shell, which mounts the
 * client providers once for every school page, so a student's sittings on it
 * read Convex through them.
 */
export default function SchoolHomePage() {
  return <TenantHome />;
}
