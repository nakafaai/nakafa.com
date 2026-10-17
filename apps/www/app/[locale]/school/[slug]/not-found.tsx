import { TenantMissing } from "@/components/tenant/missing";

/**
 * The not-found page of an address below a school that no page of the school
 * answers. It shows inside the school shell, and its one way on leads to the
 * school's home, which is the root of the school host.
 */
export default function SchoolPageNotFound() {
  return <TenantMissing homeHref="/" />;
}
