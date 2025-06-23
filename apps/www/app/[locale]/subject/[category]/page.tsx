import { redirect } from "next/navigation";
import { getStaticParams } from "@/lib/utils/system";

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category"],
  });
}

export default function Page() {
  // This is empty page, redirect to home page
  redirect("/");
}
