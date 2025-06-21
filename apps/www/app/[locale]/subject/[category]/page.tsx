import { getStaticParams } from "@/lib/utils/system";
import { redirect } from "next/navigation";

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
