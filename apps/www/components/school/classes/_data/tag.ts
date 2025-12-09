import type { SchoolClassMemberRole } from "@repo/backend/convex/classes/schema";
import type { SchoolMemberRole } from "@repo/backend/convex/schools/schema";
import {
  CircleQuestionMarkIcon,
  HandIcon,
  LightbulbIcon,
  NotebookTabsIcon,
  SmileIcon,
} from "lucide-react";

export const tagList = [
  {
    icon: SmileIcon,
    value: "general",
  },
  {
    icon: CircleQuestionMarkIcon,
    value: "question",
  },
  {
    icon: HandIcon,
    value: "announcement",
  },
  {
    icon: NotebookTabsIcon,
    value: "assignment",
  },
  {
    icon: LightbulbIcon,
    value: "resource",
  },
] as const;

export type TagValue = (typeof tagList)[number]["value"];

// Tags available for students (general discussions and questions only)
const studentTags: TagValue[] = ["general", "question"];

export function getTagIcon(tag: TagValue) {
  return tagList.find((t) => t.value === tag)?.icon ?? SmileIcon;
}

/**
 * Get available tags based on user's effective role.
 * School admins and teachers can use all tags.
 * Students can only use general and question tags.
 */
export function getTagsByRole(
  classMemberRole: SchoolClassMemberRole,
  schoolMemberRole: SchoolMemberRole
) {
  // School admins or class teachers get all tags
  if (schoolMemberRole === "admin" || classMemberRole === "teacher") {
    return tagList;
  }
  return tagList.filter((tag) => studentTags.includes(tag.value));
}
