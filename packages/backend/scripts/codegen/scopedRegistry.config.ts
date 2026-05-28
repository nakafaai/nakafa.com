/** Confect groups that get isolated Convex registries for cold-start locality. */
export const scopedRegistries = [
  {
    group: "auth",
    layer: "authLayer",
    layerImport: "@repo/backend/confect/modules/identity/auth/auth.impl",
    spec: "authGroup",
    specImport: "@repo/backend/confect/modules/identity/auth/auth.spec",
  },
  {
    group: "users",
    layer: "usersLayer",
    layerImport: "@repo/backend/confect/modules/identity/users/users.impl",
    spec: "usersGroup",
    specImport: "@repo/backend/confect/modules/identity/users/users.spec",
  },
  {
    group: "chats",
    layer: "chatsLayer",
    layerImport: "@repo/backend/confect/modules/chat/chats/chats.impl",
    spec: "chatsGroup",
    specImport: "@repo/backend/confect/modules/chat/chats/chats.spec",
  },
  {
    group: "classes",
    layer: "classesLayer",
    layerImport: "@repo/backend/confect/modules/school/classes/classes.impl",
    spec: "classesGroup",
    specImport: "@repo/backend/confect/modules/school/classes/classes.spec",
  },
  {
    group: "schools",
    layer: "schoolsLayer",
    layerImport: "@repo/backend/confect/modules/school/schools/schools.impl",
    spec: "schoolsGroup",
    specImport: "@repo/backend/confect/modules/school/schools/schools.spec",
  },
  {
    group: "assessments",
    layer: "assessmentsLayer",
    layerImport:
      "@repo/backend/confect/modules/school/assessments/assessments.impl",
    spec: "assessmentsGroup",
    specImport:
      "@repo/backend/confect/modules/school/assessments/assessments.spec",
  },
  {
    group: "subscriptions",
    layer: "subscriptionsLayer",
    layerImport:
      "@repo/backend/confect/modules/commerce/subscriptions/subscriptions.impl",
    spec: "subscriptionsGroup",
    specImport:
      "@repo/backend/confect/modules/commerce/subscriptions/subscriptions.spec",
  },
  {
    group: "credits",
    layer: "creditsLayer",
    layerImport: "@repo/backend/confect/modules/commerce/credits/credits.impl",
    spec: "creditsGroup",
    specImport: "@repo/backend/confect/modules/commerce/credits/credits.spec",
  },
  {
    group: "customers",
    layer: "customersLayer",
    layerImport:
      "@repo/backend/confect/modules/commerce/customers/customers.impl",
    spec: "customersGroup",
    specImport:
      "@repo/backend/confect/modules/commerce/customers/customers.spec",
  },
  {
    group: "comments",
    layer: "commentsLayer",
    layerImport: "@repo/backend/confect/modules/content/comments/comments.impl",
    spec: "commentsGroup",
    specImport: "@repo/backend/confect/modules/content/comments/comments.spec",
  },
  {
    group: "contents",
    layer: "contentsLayer",
    layerImport: "@repo/backend/confect/modules/content/contents/contents.impl",
    spec: "contentsGroup",
    specImport: "@repo/backend/confect/modules/content/contents/contents.spec",
  },
  {
    group: "contentSync",
    layer: "contentSyncLayer",
    layerImport:
      "@repo/backend/confect/modules/content/contentSync/contentSync.impl",
    spec: "contentSyncGroup",
    specImport:
      "@repo/backend/confect/modules/content/contentSync/contentSync.spec",
  },
  {
    group: "audioStudies",
    layer: "audioStudiesLayer",
    layerImport:
      "@repo/backend/confect/modules/content/audioStudies/audioStudies.impl",
    spec: "audioStudiesGroup",
    specImport:
      "@repo/backend/confect/modules/content/audioStudies/audioStudies.spec",
  },
  {
    group: "subjectSections",
    layer: "subjectSectionsLayer",
    layerImport:
      "@repo/backend/confect/modules/content/subjectSections/subjectSections.impl",
    spec: "subjectSectionsGroup",
    specImport:
      "@repo/backend/confect/modules/content/subjectSections/subjectSections.spec",
  },
  {
    group: "exercises",
    layer: "exercisesLayer",
    layerImport:
      "@repo/backend/confect/modules/learning/exercises/exercises.impl",
    spec: "exercisesGroup",
    specImport:
      "@repo/backend/confect/modules/learning/exercises/exercises.spec",
  },
  {
    group: "irt",
    layer: "irtLayer",
    layerImport: "@repo/backend/confect/modules/tryout/irt/irt.impl",
    spec: "irtGroup",
    specImport: "@repo/backend/confect/modules/tryout/irt/irt.spec",
  },
  {
    group: "tryouts",
    layer: "tryoutsLayer",
    layerImport: "@repo/backend/confect/modules/tryout/tryouts/tryouts.impl",
    spec: "tryoutsGroup",
    specImport: "@repo/backend/confect/modules/tryout/tryouts/tryouts.spec",
  },
  {
    group: "tryoutAccess",
    layer: "tryoutAccessLayer",
    layerImport:
      "@repo/backend/confect/modules/tryout/tryoutAccess/tryoutAccess.impl",
    spec: "tryoutAccessGroup",
    specImport:
      "@repo/backend/confect/modules/tryout/tryoutAccess/tryoutAccess.spec",
  },
  {
    group: "emails",
    layer: "emailsLayer",
    layerImport:
      "@repo/backend/confect/modules/notifications/emails/emails.impl",
    spec: "emailsGroup",
    specImport:
      "@repo/backend/confect/modules/notifications/emails/emails.spec",
  },
  {
    group: "notifications",
    layer: "notificationsLayer",
    layerImport:
      "@repo/backend/confect/modules/notifications/notifications/notifications.impl",
    spec: "notificationsGroup",
    specImport:
      "@repo/backend/confect/modules/notifications/notifications/notifications.spec",
  },
  {
    group: "triggers",
    layer: "triggersLayer",
    layerImport:
      "@repo/backend/confect/modules/operations/triggers/triggers.impl",
    spec: "triggersGroup",
    specImport:
      "@repo/backend/confect/modules/operations/triggers/triggers.spec",
  },
] as const;

/** Fast lookup for generated Convex path to scoped registry mapping. */
export const scopedRegistryGroups = new Set<string>(
  scopedRegistries.map((registry) => registry.group)
);
