import { redirect } from "next/navigation";

/** The settings root opens the school's first section, its profile. */
export default function SchoolSettingsPage() {
  redirect("/settings/profile");
}
