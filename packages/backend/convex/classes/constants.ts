/**
 * Class images
 */
export const CLASS_IMAGES = new Map([
  ["retro", "/classes/retro.png"],
  ["time", "/classes/time.png"],
  ["stars", "/classes/stars.png"],
  ["chill", "/classes/chill.png"],
  ["puzzle", "/classes/puzzle.png"],
  ["line", "/classes/line.png"],
  ["shoot", "/classes/shoot.png"],
  ["virus", "/classes/virus.png"],
  ["ball", "/classes/ball.png"],
  ["duck", "/classes/duck.png"],
  ["music", "/classes/music.png"],
  ["nightly", "/classes/nightly.png"],
  ["writer", "/classes/writer.png"],
  ["barbie", "/classes/barbie.png"],
  ["fun", "/classes/fun.png"],
  ["lamp", "/classes/lamp.png"],
  ["lemon", "/classes/lemon.png"],
  ["nighty", "/classes/nighty.png"],
  ["rocket", "/classes/rocket.png"],
  ["sakura", "/classes/sakura.png"],
  ["sky", "/classes/sky.png"],
  ["stamp", "/classes/stamp.png"],
  ["vintage", "/classes/vintage.png"],
] as const);

/**
 * Get a random class image based on the text, text is the seed
 * @param text - The text to generate the image for
 * @returns The random class image
 */
export function getRandomClassImage(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    // Simple hash function to avoid collisions (e.g. "abc" vs "cba")
    // using a prime multiplier (31) and a large modulo to keep numbers safe
    hash = (hash * 31 + text.charCodeAt(i)) % 1_000_000_007;
  }

  const index = hash % CLASS_IMAGES.size;
  return Array.from(CLASS_IMAGES.values())[index];
}

/**
 * Teacher permissions
 */
export const TEACHER_PERMISSIONS = {
  // Class Management (Prefix: class_)
  CLASS_MANAGE: "class_manage", // Edit details, settings
  CLASS_ARCHIVE: "class_archive",
  CLASS_DELETE: "class_delete",

  // Member Management (Prefix: member_)
  MEMBER_MANAGE: "member_manage", // Add/remove/invite

  // Content (Prefix: content_)
  CONTENT_CREATE: "content_create",
  CONTENT_EDIT: "content_edit",
  CONTENT_DELETE: "content_delete",
  CONTENT_PUBLISH: "content_publish",

  // Grading (Prefix: grade_)
  GRADE_VIEW: "grade_view",
  GRADE_SCORE: "grade_score", // Grade submissions
  GRADE_SETUP: "grade_setup", // Configure grading system

  // Communication (Prefix: comm_)
  COMM_ANNOUNCE: "comm_announce",
  COMM_MODERATE: "comm_moderate",
  COMM_MESSAGE: "comm_message",

  // Analytics (Prefix: stats_)
  STATS_VIEW: "stats_view",
} as const;

export type TeacherPermission =
  (typeof TEACHER_PERMISSIONS)[keyof typeof TEACHER_PERMISSIONS];

// Default permission sets for common roles
export const PERMISSION_SETS = {
  // Primary Teacher (Owner) - Full access
  PRIMARY: Object.values(TEACHER_PERMISSIONS),

  // Co-Teacher - Everything except destructive class actions
  CO_TEACHER: Object.values(TEACHER_PERMISSIONS).filter(
    (p) => p !== TEACHER_PERMISSIONS.CLASS_DELETE
  ),

  // Teaching Assistant (TA) - Grading and basic management
  ASSISTANT: [
    TEACHER_PERMISSIONS.GRADE_VIEW,
    TEACHER_PERMISSIONS.GRADE_SCORE,
    TEACHER_PERMISSIONS.COMM_ANNOUNCE,
    TEACHER_PERMISSIONS.COMM_MODERATE,
    TEACHER_PERMISSIONS.STATS_VIEW,
  ] as TeacherPermission[],

  // Content Creator - Only content management
  CONTENT_CREATOR: [
    TEACHER_PERMISSIONS.CONTENT_CREATE,
    TEACHER_PERMISSIONS.CONTENT_EDIT,
    TEACHER_PERMISSIONS.CONTENT_DELETE,
    TEACHER_PERMISSIONS.CONTENT_PUBLISH,
  ] as TeacherPermission[],
};
