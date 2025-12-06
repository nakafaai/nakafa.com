export const subjectList = [
  // Core Sciences & Math
  "mathematics",
  "advanced-mathematics",
  "natural-science", // IPA (SMP)
  "physics",
  "chemistry",
  "biology",

  // Social Sciences
  "social-studies", // IPS (SMP)
  "geography",
  "history",
  "economy",
  "sociology",
  "civics",

  // Technology & Computer
  "informatics",
  "geospatial",
  "computer-science",
  "ai-ds",
  "game-engineering",
  "informatics-engineering",
  "technology-electro-medical",

  // Languages & Arts
  "indonesian",
  "sundanese",
  "javanese",
  "balinese",
  "madurese",
  "minangkabau",
  "betawi",
  "english",
  "literature",
  "arts",
  "music",
  "crafts", // Prakarya

  // Physical & Health
  "physical-education",
  "health-education",

  // Religion
  "islamic-education",
  "christian-education",
  "catholic-education",
  "hindu-education",
  "buddhist-education",
  "confucian-education",

  // Social & Politics
  "political-science",
  "international-relations",

  // Vocational
  "accounting",
  "business",
  "entrepreneurship",

  // Others
  "guidance-counseling",
] as const;

export type Subject = (typeof subjectList)[number];
