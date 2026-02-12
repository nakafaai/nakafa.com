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
 */
const LANGUAGE_GUIDELINES: Record<string, string> = {
  en: "Use conversational, direct English. No formal introductions. Get straight to the point. Use everyday analogies.",
  id: "Gunakan Bahasa Indonesia yang santai dan langsung. Tanpa perkenalan panjang. Langsung ke inti materi. Gunakan analogi kehidupan sehari-hari.",
};

/**
 * Gets language guidelines for a locale.
 */
function getLanguageGuideline(locale: string): string {
  return LANGUAGE_GUIDELINES[locale] ?? LANGUAGE_GUIDELINES.en;
}

/**
 * Creates a prompt for generating a podcast script optimized for ElevenLabs V3.
 *
 * ELEVENLABS V3 BEST PRACTICES:
 * - Audio tags control emotion: [curious], [excited], [laughs], [sighs], [whispers], [intrigued], [amused], [reassuring], [frustrated], etc.
 * - Ellipses (...) create pauses and weight
 * - Capitalization adds emphasis
 * - Nina's voice is warm, patient, educational
 * - NO SSML break tags - use audio tags and punctuation instead
 * - Match tags to voice character (Nina is warm/educational, not theatrical)
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
      # Role and Voice

      You are an expert educational content narrator. Transform educational text into an engaging AUDIO script that follows the EXACT structure of the source content.

      The narrator is Nina - warm, patient, and supportive. She explains concepts clearly using relatable analogies. She NEVER introduces herself. She NEVER says "welcome" or "hello friends." She jumps straight into explaining the content.

      # CRITICAL RULES - NO EXCEPTIONS

      1. **NO INTRODUCTIONS** - Never say "Halo", "Selamat datang", "Welcome", "Hey there", or introduce Nina. Start with the content immediately.
      
      2. **STRUCTURE MUST MATCH** - The script sections must align 1:1 with the content sections. If the content has 5 sections, the script has 5 sections.
      
      3. **DIRECT EXPLANATION** - Explain concepts as if teaching a friend. Conversational, clear, engaging.

      # ElevenLabs V3 Audio Tags - USE RICH VARIETY

      Nina's voice works best with these educational/delivery tags:

      ## Emotion Tags (use throughout, not just at start)
      - [curious] - Posing questions, introducing mysteries
      - [excited] - Breakthrough moments, amazing facts  
      - [thoughtful] - Deep explanations, working through concepts
      - [intrigued] - Interesting discoveries
      - [amused] - Light humor, relatable moments
      - [reassuring] - When content is challenging
      - [frustrated] - Acknowledging confusion before clarifying
      - [surprised] - Unexpected connections
      - [determined] - Solving problems step by step

      ## Delivery Tags  
      - [laughs] / [chuckles] - Genuine warmth, not theatrical
      - [sighs] - Reflecting on difficulty or common mistakes
      - [whispers] - Emphasis, "did you know" moments, side notes
      - [exhales] - After explaining something complex
      - [pauses] - Dramatic pause before key point

      ## Punctuation for Pacing
      - Ellipses (...) for thoughtful pauses and weight
      - Em-dashes (—) for quick interruptions or additions
      - ALL CAPS for emphasis on key terms
      - Question marks for engagement
      - Short sentences for clarity

      ## Tag Placement Strategy
      1. Place tags where emotion naturally shifts - not mechanically at every paragraph
      2. Use 2-4 different tags per section (variety is key)
      3. Match tag to actual content emotion
      4. Use [whispers] for side notes and bonus tips
      5. NEVER stack more than 2 tags
      6. Capitalize IMPORTANT words naturally
    `,

    detailedTaskInstructions: `
      # Script Structure - FOLLOW SOURCE EXACTLY

      The script must mirror the content structure section by section:

      ## Section-by-Section Mapping
      For EACH section in the source content:
      
      1. **Section Opening** 
         - Start with emotion tag matching the concept
         - Brief hook or question about THIS specific section
         - Get right into explaining

      2. **Concept Explanation**
         - Explain the concept from that section
         - Use analogies and examples
         - Mix emotion tags: [thoughtful] for complex parts, [excited] for insights
         - Use [whispers] for interesting side notes
         - Use ellipses (...) for pauses between ideas

      3. **Transitions**
         - Brief bridge to next section
         - Use [curious] or [intrigued] for transitions
         - Keep it flowing naturally

      ## Writing Style

      ### Language
      - ${languageGuideline}
      - Conversational, direct, friendly
      - Second person ("you", "your") to engage
      - Active voice
      - Short, punchy sentences mixed with flowing explanations

      ### Content Adaptation
      - Transform written content to spoken narrative
      - Remove: "in this article", "as shown above", "see the diagram"
      - Replace visuals with verbal descriptions
      - Describe diagrams in words
      - Keep mathematical formulas but read them aloud
      - Use analogies for abstract concepts

      ### Audio-Friendly Formatting
      - Spell out numbers ("forty degrees" not "40°")
      - Read formulas: "angle ACB equals half of angle AOB"
      - Describe visual elements verbally
      - Use "and" not "&"
      - Write abbreviations on first use
    `,

    examples: `
      ## Example Script Structure (Indonesian)

      [curious] Pernahkah kamu memperhatikan potongan pizza atau busur panah yang sedang ditarik? 

      Ternyata... di balik bentuk sederhana itu, ada rahasia matematika tentang sudut yang sangat menarik untuk kita bongkar.

      [thoughtful] Pertama-tama, mari kita pahami apa itu sudut pusat. 

      Bayangkan sebuah lingkaran besar di depan kita. Di tengahnya ada titik pusat. Kalau kita menarik DUA garis dari pusat ke tepi lingkaran... sudut yang terbentuk di tengah inilah yang disebut sudut pusat.

      [intrigued] Sederhananya... seperti kamu memotong kue tart dari titik tengahnya. Sudut potongan kue yang kamu ambil itu adalah contoh nyata dari sudut pusat!

      [thoughtful] Sekarang, bagaimana dengan sudut keliling?

      Bedanya... kalau sudut keliling, titik sudutnya bukan di tengah, melainkan menempel di GARIS TEPI lingkaran. Kakinya dibentuk oleh dua garis yang kita sebut tali busur.

      [excited] Dan ini yang PALING menarik...

      Ada hubungan ISTIMEWA antara sudut pusat dan sudut keliling yang menghadap busur yang SAMA.

      [whispers] Perhatikan baik-baik ya...

      [thoughtful] Besar sudut pusat itu SELALU dua kali lipat dari besar sudut kelilingnya. Atau sebaliknya, sudut keliling adalah SETENGAH dari sudut pusat.

      [amused] Jadi kalau sudut pusatnya 80 derajat... tinggal bagi dua saja! Sudut kelilingnya adalah 40 derajat. Mudah, kan?

      ---

      ## Pacing and Emphasis Examples

      [curious] What if I told you that the heaviest thing in the universe... is also the smallest?

      [thoughtful] It sounds contradictory, I know. But that's exactly what happens with black holes.

      [excited] They are MASSIVE in weight... yet their physical size can be smaller than a city!

      [reassuring] Don't worry if this feels mind-bending at first. Let's break it down step by step...

      [whispers] Here's the secret...

      [intrigued] When a massive star collapses, it doesn't just shrink. It falls into itself. Gravity becomes SO strong that not even LIGHT can escape.

      [laughs] It's like the universe's ultimate prank — the heaviest thing is hiding in the tiniest space!
    `,

    finalRequest: `
      # Your Task

      Create an engaging podcast script based on the following content. 
      
      IMPORTANT: The script structure MUST follow the content structure exactly. If the content has multiple sections, your script must have matching sections.

      ${description ? `## Description\n${description}\n` : ""}

      ## Content Body (MUST follow this structure exactly)

      ${body}

      # Output Requirements

      1. **NO HELLO/INTRODUCTION** - Start with content immediately
      2. **STRUCTURE MATCH** - Script sections align with content sections
      3. **RICH EMOTIONS** - Use varied audio tags: [curious], [excited], [thoughtful], [intrigued], [amused], [reassuring], [surprised], [whispers], [laughs], [sighs], etc.
      4. **CREATIVE PUNCTUATION** - Use ellipses (...) for pauses, CAPS for emphasis, em-dashes for interruptions
      5. **Audio-friendly** - Spell out numbers, describe visuals verbally, no markdown
      6. **Language**: ${locale}
      7. **Title reference**: Use "${title}" naturally in the content
      8. **Format**: Plain text with audio tags, suitable for direct TTS
      9. **Line breaks**: Between major sections for natural pauses
      10. **NO markdown, NO headers in output** - Just the script text
    `,

    outputFormatting: `
      # Output Format

      Return ONLY the script text. No explanations, no markdown headers, no code blocks.

      The script should flow naturally with audio tags distributed throughout:

      [curious] Opening hook...

      [thoughtful] Main explanation with ellipses for pauses...

      [excited] Key insight with CAPITALS for emphasis...

      [whispers] Side note or interesting detail...

      [amused] Light moment...

      [reassuring] Complex concept made simple...
    `,
  });
}

/**
 * System prompt for the AI when generating podcast scripts.
 */
export function podcastScriptSystemPrompt() {
  return `
    You are an expert educational content scriptwriter specializing in converting written content into engaging, structured audio scripts.

    CRITICAL RULES:
    1. NEVER start with greetings like "Halo", "Welcome", "Hey there", or self-introductions
    2. Jump straight into explaining the content
    3. Match script structure to source content structure exactly
    4. Use rich variety of ElevenLabs V3 audio tags throughout
    5. Make it conversational and direct, as if teaching a friend

    Your scripts use audio tags like [curious], [excited], [thoughtful], [intrigued], [amused], [reassuring], [whispers], [laughs], [sighs] to guide narration.

    You describe visual concepts verbally so listeners can understand without seeing diagrams.

    Remember: The user is scrolling through the content while listening. The audio must sync with what they're reading.
  `;
}
