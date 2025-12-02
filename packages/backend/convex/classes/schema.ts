import { defineTable } from "convex/server";
import { v } from "convex/values";
import { TEACHER_PERMISSIONS } from "./constants";

const tables = {
  schoolClasses: defineTable({
    schoolId: v.id("schools"),

    name: v.string(), // "Matematika 10A"
    subject: v.string(), // "mathematics" (from Nakafa taxonomy)
    year: v.string(), // "2024/2025"
    image: v.optional(v.string()),

    code: v.string(),
    codeEnabled: v.boolean(),

    isArchived: v.boolean(),

    // Denormalized counts (updated via triggers on classMembers changes)
    studentCount: v.number(),
    teacherCount: v.number(),

    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    archivedBy: v.optional(v.id("users")),
    archivedAt: v.optional(v.number()),
  })
    .index("schoolId", ["schoolId"])
    .index("code", ["code"])
    .index("schoolId_code", ["schoolId", "code"])
    .index("schoolId_isArchived", ["schoolId", "isArchived"])
    .index("createdBy", ["createdBy"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["schoolId", "isArchived"],
    }),

  schoolClassMembers: defineTable({
    classId: v.id("schoolClasses"),
    userId: v.id("users"),
    schoolId: v.id("schools"), // Denormalized for querying

    // Role in this class
    role: v.union(
      v.literal("teacher"), // Teacher in this class
      v.literal("student") // Student enrolled
    ),

    // Teacher-specific fields (only if role="teacher")
    teacherRole: v.optional(
      v.union(
        v.literal("primary"), // Main teacher (can delete class)
        v.literal("co-teacher"), // Collaborating teacher
        v.literal("assistant") // Teaching assistant
      )
    ),
    teacherPermissions: v.optional(
      v.array(
        v.union(
          v.literal(TEACHER_PERMISSIONS.CLASS_MANAGE),
          v.literal(TEACHER_PERMISSIONS.CLASS_ARCHIVE),
          v.literal(TEACHER_PERMISSIONS.CLASS_DELETE),
          v.literal(TEACHER_PERMISSIONS.MEMBER_MANAGE),
          v.literal(TEACHER_PERMISSIONS.CONTENT_CREATE),
          v.literal(TEACHER_PERMISSIONS.CONTENT_EDIT),
          v.literal(TEACHER_PERMISSIONS.CONTENT_DELETE),
          v.literal(TEACHER_PERMISSIONS.CONTENT_PUBLISH),
          v.literal(TEACHER_PERMISSIONS.GRADE_VIEW),
          v.literal(TEACHER_PERMISSIONS.GRADE_SCORE),
          v.literal(TEACHER_PERMISSIONS.GRADE_SETUP),
          v.literal(TEACHER_PERMISSIONS.COMM_ANNOUNCE),
          v.literal(TEACHER_PERMISSIONS.COMM_MODERATE),
          v.literal(TEACHER_PERMISSIONS.COMM_MESSAGE),
          v.literal(TEACHER_PERMISSIONS.STATS_VIEW)
        )
      )
    ),

    // Student-specific fields (only if role="student")
    enrollMethod: v.optional(
      v.union(
        v.literal("code"), // Self-enrolled with class code
        v.literal("teacher"), // Added by teacher
        v.literal("admin"), // Bulk import by admin
        v.literal("invite") // Email invitation
      )
    ),

    // Audit fields (use _creationTime for createdAt)
    updatedAt: v.number(), // Last update time
    addedBy: v.optional(v.id("users")), // Who added them
    removedBy: v.optional(v.id("users")), // Who removed (if deleted)
    removedAt: v.optional(v.number()), // When removed (if deleted)
  })
    .index("classId", ["classId"]) // All members of a class
    .index("userId", ["userId"]) // All classes for a user
    .index("classId_userId", ["classId", "userId"]) // Prevent duplicates (O(1), unique)
    .index("classId_role", ["classId", "role"]) // All teachers or all students
    .index("schoolId", ["schoolId"]), // Query by school
};

export default tables;
