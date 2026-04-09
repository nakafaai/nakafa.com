import { use } from "react";
import { EventAccessPage } from "@/components/event/access-page";

export default function Page(
  props: PageProps<"/[locale]/event/try-out/[code]">
) {
  const { params } = props;
  const { code } = use(params);

  // Enable static rendering

  return <EventAccessPage code={code} />;
}
