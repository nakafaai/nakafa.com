import {
  ChatIcon,
  ChatQuestionIcon,
  ClipboardIcon,
  InternetIcon,
  NewsIcon,
} from "@hugeicons/core-free-icons";
import type { SchoolClassMemberRole } from "@repo/backend/convex/classes/schema";
import type { SchoolMemberRole } from "@repo/backend/convex/schools/schema";

export const tagList = [
  {
    icon: ChatIcon,
    value: "general",
  },
  {
    icon: ChatQuestionIcon,
    value: "question",
  },
  {
    icon: NewsIcon,
    value: "announcement",
  },
  {
    icon: ClipboardIcon,
    value: "assignment",
  },
  {
    icon: InternetIcon,
    value: "resource",
  },
] as const;

export type TagValue = (typeof tagList)[number]["value"];

// Tags available for students (general discussions and questions only)
const studentTags: TagValue[] = ["general", "question"];

export function getTagIcon(tag: TagValue) {
  return tagList.find((t) => t.value === tag)?.icon ?? ChatIcon;
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

/**
 * Gets the tag icon and label by value.
 * @param value - The value of the tag.
 * @returns The tag.
 */
export function getTag(value: TagValue) {
  // Default to general if no tag is found
  return tagList.find((t) => t.value === value) ?? tagList[0];
}
