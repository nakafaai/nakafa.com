import {
  ChatIcon,
  ChatQuestionIcon,
  ClipboardIcon,
  InternetIcon,
  NewsIcon,
} from "@hugeicons/core-free-icons";
import { STUDENT_FORUM_TAGS } from "@repo/backend/confect/classes/forums/constants";
import type { SchoolClassMemberRole } from "@repo/backend/confect/classes/role";
import type { SchoolMemberRole } from "@repo/backend/confect/schools/schema";
import { Array as Arr, Option } from "effect";

const tagList = [
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
type TagValue = (typeof tagList)[number]["value"];

/**
 * Resolve the icon used to represent one forum tag.
 */
export function getTagIcon(tag: TagValue) {
  return Option.match(
    Arr.findFirst(tagList, (t) => t.value === tag),
    {
      onNone: () => ChatIcon,
      onSome: (t) => t.icon,
    }
  );
}

/**
 * Get the forum tags visible to the current viewer.
 *
 * The moderation permission stays the primary source of truth, with the role
 * fallback kept aligned with the backend tag-access rule.
 */
export function getTagsByRole(
  canModerateForum: boolean,
  classMemberRole: SchoolClassMemberRole,
  schoolMemberRole: SchoolMemberRole
) {
  if (
    canModerateForum ||
    schoolMemberRole === "admin" ||
    classMemberRole === "teacher"
  ) {
    return tagList;
  }
  return Arr.filter(tagList, (tag) =>
    Arr.some(STUDENT_FORUM_TAGS, (studentTag) => studentTag === tag.value)
  );
}

/**
 * Gets the tag icon and label by value.
 * @param value - The value of the tag.
 * @returns The tag.
 */
export function getTag(value: TagValue) {
  // Default to general if no tag is found
  return Option.getOrElse(
    Arr.findFirst(tagList, (t) => t.value === value),
    () => tagList[0]
  );
}
