"use client";

import { redirect } from "next/navigation";
import { useSchool } from "@/lib/context/use-school";

export default function Page() {
  const school = useSchool((state) => state.school);

  redirect(`/school/${school.slug}/dashboard`);
}
