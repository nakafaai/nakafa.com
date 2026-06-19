import {
  AssignmentsIcon,
  BookUserIcon,
  GraduationCapIcon,
  MentorIcon,
  MentoringIcon,
  SchoolIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import {
  type SelfSelectableUserRole,
  selfSelectableUserRoles,
} from "@repo/backend/convex/users/roles";
import type {
  LearningInterest,
  LearningProgramKind,
} from "@repo/contents/_types/program/schema";
import { roleIconByValue } from "@/lib/data/roles";

/** Normal Nakafa roles accepted by the learner-facing onboarding flow. */
export type OnboardingRole = SelfSelectableUserRole;

/** One role card shown on the first onboarding step. */
export interface RoleOption {
  descriptionKey: `onboarding.role.${OnboardingRole}.description`;
  icon: IconSvgElement;
  key: OnboardingRole;
  titleKey: `onboarding.role.${OnboardingRole}.title`;
}

const studentSchoolFocusKey = "student-school";
const studentExamFocusKey = "student-exam";
const teacherMaterialsFocusKey = "teacher-materials";
const teacherPracticeFocusKey = "teacher-practice";
const parentUnderstandFocusKey = "parent-understand";
const parentPracticeFocusKey = "parent-practice";

export const onboardingFocusKeys = [
  studentSchoolFocusKey,
  studentExamFocusKey,
  teacherMaterialsFocusKey,
  teacherPracticeFocusKey,
  parentUnderstandFocusKey,
  parentPracticeFocusKey,
] as const;

export type OnboardingFocusKey = (typeof onboardingFocusKeys)[number];

const studentFocusOptions = [
  {
    descriptionKey: "onboarding.focus.student.school.description",
    icon: SchoolIcon,
    interest: "school-curriculum",
    key: studentSchoolFocusKey,
    preferredKinds: ["school-curriculum"],
    titleKey: "onboarding.focus.student.school.title",
  },
  {
    descriptionKey: "onboarding.focus.student.exam.description",
    icon: GraduationCapIcon,
    interest: "exam-prep",
    key: studentExamFocusKey,
    preferredKinds: ["admission-exam"],
    titleKey: "onboarding.focus.student.exam.title",
  },
] as const;

const teacherFocusOptions = [
  {
    descriptionKey: "onboarding.focus.teacher.materials.description",
    icon: MentorIcon,
    interest: "school-curriculum",
    key: teacherMaterialsFocusKey,
    preferredKinds: ["school-curriculum"],
    titleKey: "onboarding.focus.teacher.materials.title",
  },
  {
    descriptionKey: "onboarding.focus.teacher.practice.description",
    icon: AssignmentsIcon,
    interest: "assessment-prep",
    key: teacherPracticeFocusKey,
    preferredKinds: ["assessment", "admission-exam"],
    titleKey: "onboarding.focus.teacher.practice.title",
  },
] as const;

const parentFocusOptions = [
  {
    descriptionKey: "onboarding.focus.parent.understand.description",
    icon: BookUserIcon,
    interest: "school-curriculum",
    key: parentUnderstandFocusKey,
    preferredKinds: ["school-curriculum"],
    titleKey: "onboarding.focus.parent.understand.title",
  },
  {
    descriptionKey: "onboarding.focus.parent.practice.description",
    icon: MentoringIcon,
    interest: "assessment-prep",
    key: parentPracticeFocusKey,
    preferredKinds: ["assessment", "admission-exam"],
    titleKey: "onboarding.focus.parent.practice.title",
  },
] as const;

export const roleOptions = [
  {
    descriptionKey: "onboarding.role.student.description",
    icon: roleIconByValue.student,
    key: "student",
    titleKey: "onboarding.role.student.title",
  },
  {
    descriptionKey: "onboarding.role.teacher.description",
    icon: roleIconByValue.teacher,
    key: "teacher",
    titleKey: "onboarding.role.teacher.title",
  },
  {
    descriptionKey: "onboarding.role.parent.description",
    icon: roleIconByValue.parent,
    key: "parent",
    titleKey: "onboarding.role.parent.title",
  },
] as const satisfies readonly RoleOption[];

export const focusOptionsByRole = {
  parent: parentFocusOptions,
  student: studentFocusOptions,
  teacher: teacherFocusOptions,
} as const satisfies {
  [Role in OnboardingRole]: readonly {
    descriptionKey: string;
    icon: IconSvgElement;
    interest: LearningInterest;
    key: string;
    preferredKinds: readonly LearningProgramKind[];
    titleKey: string;
  }[];
};

export type FocusOption = (typeof focusOptionsByRole)[OnboardingRole][number];

/** Runtime role values shared with the user profile role mutation. */
export const onboardingRoles = selfSelectableUserRoles;
