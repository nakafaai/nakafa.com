import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  schools: defineTable({
    name: v.string(), // "SMA Negeri 1 Jakarta"
    slug: v.string(), // "sma-negeri-1-jakarta" (unique, URL-friendly)
    email: v.string(), // Contact email
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.string(),
    province: v.string(),
    type: v.union(
      v.literal("elementary-school"),
      v.literal("middle-school"),
      v.literal("high-school"),
      v.literal("vocational-school"),
      v.literal("university"),
      v.literal("other")
    ),

    // Analytics (denormalized counts, updated via triggers)
    currentStudents: v.number(),
    currentTeachers: v.number(),

    // Audit fields (use _creationTime for createdAt)
    updatedAt: v.number(), // Last update time
    createdBy: v.id("users"), // Who created this school
    updatedBy: v.optional(v.id("users")), // Who last updated
  })
    .index("slug", ["slug"]) // GET /school/[slug] (unique lookup)
    .index("createdBy", ["createdBy"]) // User's schools
    .index("email", ["email"]),

  schoolMembers: defineTable({
    schoolId: v.id("schools"),
    userId: v.id("users"),

    // Role in this school (can be different per school)
    role: v.union(
      v.literal("admin"), // Can manage school settings
      v.literal("teacher"), // Can create classes
      v.literal("student"), // Can view assignments
      v.literal("parent") // Can monitor children
    ),

    status: v.union(
      v.literal("active"), // Active member
      v.literal("invited"), // Invited but not joined yet
      v.literal("removed") // Soft delete
    ),

    // Invitation tracking
    invitedBy: v.optional(v.id("users")),
    invitedAt: v.optional(v.number()),
    inviteToken: v.optional(v.string()), // For email invitation links

    // Audit fields (use _creationTime for createdAt)
    updatedAt: v.number(), // Last update time
    joinedAt: v.number(), // When user actually joined (can be same as _creationTime)
    removedBy: v.optional(v.id("users")), // Who removed (if status="removed")
    removedAt: v.optional(v.number()), // When removed (if status="removed")
  })
    .index("schoolId", ["schoolId"]) // All members of a school
    .index("userId", ["userId"]) // All schools for a user
    .index("schoolId_role", ["schoolId", "role"]) // All teachers/students in school
    .index("schoolId_userId", ["schoolId", "userId"]) // Check membership (O(1), unique)
    .index("schoolId_userId_status", ["schoolId", "userId", "status"]) // Check membership (O(1), unique)
    .index("schoolId_status", ["schoolId", "status"]) // Filter by status
    .index("inviteToken", ["inviteToken"]),

  schoolParentStudents: defineTable({
    parentId: v.id("users"),
    studentId: v.id("users"),
    schoolId: v.id("schools"),

    // Relationship
    relationship: v.union(
      v.literal("father"),
      v.literal("mother"),
      v.literal("guardian"),
      v.literal("other")
    ),

    // Permissions (array for scalability)
    permissions: v.array(v.string()), // ["view_grades", "view_progress", "receive_notifications"]

    // Verification
    status: v.union(
      v.literal("pending"), // Invited but not verified
      v.literal("verified"), // Email/phone verified
      v.literal("inactive") // Disabled
    ),

    verifiedEmail: v.optional(v.string()),
    verifiedPhone: v.optional(v.string()),

    // Audit fields (use _creationTime for createdAt)
    updatedAt: v.number(), // Last update time
    verifiedAt: v.optional(v.number()),
    verifiedBy: v.optional(v.id("users")), // Who verified (admin/teacher)
  })
    .index("parentId", ["parentId"]) // Get all children
    .index("studentId", ["studentId"]) // Get all parents
    .index("parentId_studentId", ["parentId", "studentId"]) // Prevent duplicates (unique)
    .index("schoolId", ["schoolId"]) // Query by school
    .index("status", ["status"]), // Filter by verification status

  schoolActivityLogs: defineTable({
    schoolId: v.id("schools"),
    userId: v.id("users"), // Who did the action

    // Type-safe actions
    action: v.union(
      // School actions
      v.literal("school_created"),
      v.literal("school_updated"),
      v.literal("school_deleted"),

      // Member actions
      v.literal("member_invited"),
      v.literal("member_joined"),
      v.literal("member_removed"),
      v.literal("member_role_changed"),

      // Class actions
      v.literal("class_created"),
      v.literal("class_updated"),
      v.literal("class_archived"),
      v.literal("class_deleted"),
      v.literal("class_code_regenerated"),

      // Class member actions
      v.literal("class_member_added"),
      v.literal("class_member_removed"),
      v.literal("class_member_role_changed"),
      v.literal("class_member_permissions_changed"),

      // Parent actions
      v.literal("parent_linked"),
      v.literal("parent_unlinked"),
      v.literal("parent_permissions_changed"),

      // Assignment actions (for future)
      v.literal("assignment_created"),
      v.literal("assignment_updated"),
      v.literal("assignment_deleted"),
      v.literal("assignment_published"),

      // Progress actions (for future)
      v.literal("progress_updated"),
      v.literal("assignment_completed")
    ),

    // Type-safe entity types
    entityType: v.union(
      v.literal("schools"),
      v.literal("schoolMembers"),
      v.literal("classes"),
      v.literal("classMembers"),
      v.literal("parentStudents"),
      v.literal("assignments"),
      v.literal("progresses")
    ),

    entityId: v.string(), // ID of affected entity

    // Context (type-safe based on action)
    metadata: v.optional(v.any()), // Additional context (JSON)
    // Structure depends on action type

    // Security audit
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),

    // Note: Use _creationTime for when action occurred
  })
    .index("schoolId", ["schoolId"]) // All activities for a school
    .index("userId", ["userId"]) // User's activities
    .index("action", ["action"]) // Filter by action type
    .index("entityType_entityId", ["entityType", "entityId"]), // Track specific entity changes
};

export default tables;
