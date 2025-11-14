import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  classes: defineTable({
    schoolId: v.id("schools"),

    // Class info
    name: v.string(), // "Matematika 10A"
    subject: v.string(), // "mathematics" (from Nakafa taxonomy)
    year: v.string(), // "2024/2025"

    // Enrollment
    code: v.string(), // "MTK-ABC123" (for student self-enroll, unique per school)
    codeEnabled: v.boolean(), // Can students join with code?

    // Status
    isArchived: v.boolean(), // Soft delete

    // Denormalized counts (updated via triggers on classMembers changes)
    studentCount: v.number(),
    teacherCount: v.number(),

    // Audit fields (use _creationTime for createdAt)
    updatedAt: v.number(), // Last update time
    createdBy: v.id("users"), // Who created (usually first teacher)
    updatedBy: v.optional(v.id("users")), // Who last updated
    archivedBy: v.optional(v.id("users")), // Who archived (if isArchived=true)
    archivedAt: v.optional(v.number()), // When archived (if isArchived=true)
  })
    .index("schoolId", ["schoolId"]) // School's classes
    .index("code", ["code"]) // Join by code (O(1), should be unique per school)
    .index("schoolId_code", ["schoolId", "code"]) // Unique code per school
    .index("schoolId_isArchived", ["schoolId", "isArchived"]) // Active classes only
    .index("createdBy", ["createdBy"]), // Teacher's classes

  classMembers: defineTable({
    classId: v.id("classes"),
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
    teacherPermissions: v.optional(v.array(v.string())), // ["edit", "grade", "create_assignments"]

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
