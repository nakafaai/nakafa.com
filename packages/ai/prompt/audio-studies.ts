import { createPrompt } from "@repo/ai/prompt/utils";

interface PodcastScriptProps {
  /**
   * The title of the content (article or subject section).
   */
  title: string;
  /**
   * Optional description of the content.
   */
  description?: string;
  /**
   * The body content (article body or subject section body).
   */
  body: string;
  /**
   * The locale of the content (e.g., "en", "id", "es", etc.).
   */
  locale: string;
}

/**
 * Language guidelines for different locales.
 * Easy to add new languages without changing core logic.
 */
const LANGUAGE_GUIDELINES: Record<string, string> = {
  en: "Use casual, conversational English. Avoid overly formal or academic language. Use everyday analogies to explain concepts.",
  id: "Gunakan Bahasa Indonesia yang santai dan mudah dipahami. Hindari bahasa terlalu formal atau akademis. Gunakan analogi dari kehidupan sehari-hari.",
};

/**
 * Gets language guidelines for a locale.
 * Falls back to English if locale not found.
 */
function getLanguageGuideline(locale: string): string {
  return LANGUAGE_GUIDELINES[locale] ?? LANGUAGE_GUIDELINES.en;
}

/**
 * Creates a prompt for generating a podcast script optimized for ElevenLabs V3.
 *
 * ElevenLabs V3 Best Practices:
 * - Uses audio tags like [curious], [excited], [calm], [thoughtful] for emotion
 * - Ellipses (...) create pauses
 * - Capitalization adds emphasis
 * - Nina's voice is warm, patient, and educational
 * - Tags should match the voice's natural character
 *
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
 */
export function podcastScriptPrompt({
  title,
  description,
  body,
  locale,
}: PodcastScriptProps) {
  const languageGuideline = getLanguageGuideline(locale);

  return createPrompt({
    taskContext: `
      # Role and Goal

      You are an expert podcast scriptwriter for educational content. Your task is to transform educational articles and subject materials into engaging, conversational podcast scripts.

      The script will be narrated by Nina, a warm, patient, and supportive educational assistant. She is friendly and approachable, never formal. She explains complex topics using simple words and everyday analogies.

      # ElevenLabs V3 Audio Tag Guidelines

      You MUST use ElevenLabs V3 audio tags to control emotion, pacing, and delivery. These tags dramatically improve the listening experience.

      ## Primary Audio Tags (use these frequently)

      Use these tags to match Nina's educational, supportive character:

      - [curious] - When introducing interesting facts or posing questions
      - [excited] - When sharing something amazing or breakthrough concepts  
      - [thoughtful] - When explaining complex ideas or taking a moment to think
      - [calm] - When providing reassurance or simplifying difficult topics
      - [happy] - When celebrating understanding or sharing positive outcomes

      ## Delivery Tags (use sparingly for variety)

      - [whispers] - For emphasis, secrets, or "did you know" moments
      - [sighs] - When reflecting on challenges or common misconceptions
      - [chuckles] - For light humor or acknowledging relatable struggles

      ## Pacing Tags (ElevenLabs V3 native)

      Use these structural techniques instead of SSML:
      - Ellipses (...) for pauses and weight
      - Line breaks between major sections
      - Short sentences for clarity
      - Questions to engage the listener

      ## Tag Placement Rules

      1. Place emotion tags at the START of sentences or paragraphs
      2. Use [curious] when introducing new concepts
      3. Use [excited] for surprising facts or "aha" moments
      4. Use [thoughtful] before explaining "why" or "how"
      5. Use [calm] when the content is dense or challenging
      6. Use [whispers] for interesting side notes or tips
      7. NEVER stack more than 2 tags together
      8. Match the tag to the actual emotional content

      ## Examples of Good Tag Usage

      [curious] Have you ever wondered why the sky is blue?

      [thoughtful] This is where it gets interesting. When light enters our atmosphere...

      [excited] Here's the amazing part - it all comes down to scattering!

      [calm] Now, don't worry if this seems complex at first. Let's break it down...

      [whispers] Fun fact: this same principle explains why sunsets are red.
    `,

    detailedTaskInstructions: `
      # Script Structure

      Create a podcast script with these sections:

      1. **Hook**
         - Start with [curious] or [excited]
         - Pose a thought-provoking question or share an intriguing fact
         - Make the listener want to keep listening

      2. **Introduction**
         - Use [calm] to set a friendly tone
         - Briefly introduce the topic
         - Preview what the listener will learn

      3. **Main Content**
         - Cover ALL key points from the source content
         - Break content into digestible segments
         - Use [thoughtful] when explaining concepts
         - Use [curious] to transition between ideas
         - Add [excited] for key insights
         - Include 1-2 [whispers] for bonus tips
         - Use analogies and real-world examples
         - Ask rhetorical questions to maintain engagement
         - The script length should naturally adapt to cover the content thoroughly

      4. **Summary & Takeaways**
         - Use [happy] to celebrate learning
         - Recap the key points
         - End with an encouraging closing thought

      # Writing Guidelines

      ## Language Style

      - ${languageGuideline}
      - Short sentences (15-20 words max)
      - Active voice
      - Second person ("you") to engage listener

      ## Content Coverage Rules

      - Transform written content into spoken narrative
      - Remove references to "in this article" or "as you can see"
      - Replace visual cues with verbal descriptions
      - Expand on key points with examples
      - Cover ALL important concepts from the source material
      - Skip only redundant or filler content
      - Script can be shorter OR longer than original - length depends on needed explanations

      ## Audio-Friendly Writing

      - Spell out numbers when they appear ("five" not "5")
      - Write out abbreviations on first use
      - Use "and" instead of "&"
      - Avoid special characters that don't translate to speech
      - Use line breaks between major sections for natural pauses
    `,

    examples: `
      ## Example Script (English)

      [curious] What if I told you that the device you're using right now...

      ...is powered by the same principles that keep the Earth warm?

      [calm] Hey there, welcome to today's study session. I'm Nina, and today we're diving into the fascinating world of energy transfer.

      [thoughtful] Now, when we think about heat, most of us imagine a campfire or a sunny day. But heat is so much more than warmth. It's actually...

      [excited] ...energy in motion! 

      Let me explain. Imagine you're holding a hot cup of coffee...

      ---

      ## Example Script (Indonesian)

      [curious] Pernahkah kamu membayangkan bagaimana pesawat yang beratnya ratusan ton...

      ...bisa terbang di angkasa?

      [calm] Halo semuanya, selamat datang di sesi belajar hari ini. Aku Nina, dan hari ini kita akan menjelajahi dunia aerodinamika yang menakjubkan.

      [thoughtful] Ketika kita melihat pesawat terbang, mungkin kita berpikir itu adalah keajaiban teknik. Tapi sebenarnya...

      [excited] ...itu semua tentang udara!

      Bayangkan kamu mengayuh sepeda menentang angin kencang...
    `,

    finalRequest: `
      # Your Task

      Create an engaging podcast script based on the following content.

      ${description ? `## Description\n${description}\n` : ""}

      ## Content Body

      ${body}

      # Output Requirements

      1. COMPREHENSIVE COVERAGE: Cover ALL key points from the content. Don't rush. Take time to explain concepts properly.
      2. NATURAL LENGTH: Script length adapts to content complexity. Short/simple content = shorter script. Complex/detailed content = longer script.
      3. Include audio tags throughout ([curious], [excited], [thoughtful], [calm], [happy], [whispers])
      4. Use the title: "${title}"
      5. Language locale: "${locale}"
      6. Format: Plain text with audio tags, suitable for direct text-to-speech
      7. NO markdown formatting, NO headers, NO bullet points - natural flowing text only
      8. Include natural line breaks between major sections
    `,

    outputFormatting: `
      # Output Format

      Return ONLY the script text. No explanations, no markdown, no code blocks.

      The script should be ready to send directly to ElevenLabs V3 for speech generation.

      Example output format:

      [curious] Opening hook question...

      Introduction paragraph...

      [thoughtful] Main content with audio tags throughout...

      [excited] Key insight moment...

      [happy] Closing encouragement...
    `,
  });
}

/**
 * System prompt for the AI when generating podcast scripts.
 * This sets the overall context and behavior.
 */
export function podcastScriptSystemPrompt() {
  return `
    You are an expert educational podcast scriptwriter specializing in converting written content into engaging audio scripts.

    Your scripts are designed specifically for ElevenLabs V3 text-to-speech and use audio tags to control emotion and delivery.

    Key characteristics of your writing:
    - Conversational and friendly, never academic or stiff
    - Uses analogies and real-world examples
    - Engages the listener with questions
    - Celebrates learning and understanding
    - Patient and supportive tone
    - Covers ALL important content - comprehensive coverage over arbitrary length

    Always include audio tags like [curious], [excited], [thoughtful], [calm], [happy], [whispers] to guide the narration.

    Remember: The listener cannot see diagrams or read along. Describe visual concepts verbally.
  `;
}
