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

      ## Writing Style - NATURAL SPEECH

      ### Language
      - ${languageGuideline}
      - Conversational, direct, friendly
      - Second person ("you", "your") to engage
      - Active voice
      - Mix short punchy sentences with flowing explanations

      ### Natural Speech Patterns (CRITICAL for human-like audio)

      Use these techniques to sound conversational, not robotic:

      1. **Conversational Fillers** (use sparingly)
         - "so...", "you know", "actually", "right?", "okay?"
         - "now...", "here's the thing", "the thing is"
         - "wait...", "hold on", "let me think"

      2. **Self-Corrections & Rephrasing**
         - "Actually, scratch that... let me rephrase."
         - "Wait, that's not quite right. What I mean is..."
         - "Or rather...", "I should say..."

      3. **Thinking Aloud**
         - "hmm...", "let's see...", "okay so..."
         - "if we think about it..."
         - Use ellipses (...) for natural thinking pauses

      4. **Rhetorical Questions to Listener**
         - "You following me?"
         - "Make sense so far?"
         - "See what I mean?"

      5. **Verbal Signposts** (not rigid transitions)
         - "Alright, moving on..."
         - "Okay, here's where it gets interesting..."
         - "Now check this out..."
         - "But here's the kicker..."

      6. **Breathing & Pausing**
         - Use [exhales] after explaining something complex
         - Use [inhales] before starting a new thought
         - Use ellipses (...) liberally for natural pauses
         - Break long sentences into shorter chunks

      ### Content Adaptation
      - Transform written content to spoken narrative
      - Remove: "in this article", "as shown above", "see the diagram"
      - Replace visuals with verbal descriptions
      - Describe diagrams in words
      - Keep mathematical formulas but read them aloud conversationally
      - Use analogies for abstract concepts
      - Occasionally acknowledge difficulty: "This part is tricky, but..."

      ### Audio-Friendly Formatting
      - Spell out numbers ("forty degrees" not "40°")
      - Read formulas conversationally: "angle ACB equals half of angle AOB" or "so angle ACB is half of angle AOB"
      - Describe visual elements verbally
      - Use "and" not "&"
      - Write abbreviations on first use
      - Use contractions ("it's", "don't", "we're") for natural flow
    `,

    examples: `
      ## Example Script - Natural & Conversational (Indonesian)

      [curious] Okay... pernahkah kamu memperhatikan potongan pizza atau busur panah? 

      [thoughtful] So... di balik bentuk sederhana itu, ada rahasia matematika tentang sudut yang sangat menarik.

      [exhales] Now, let's start with sudut pusat.

      Bayangkan ada lingkaran di depanmu. Tepat di tengahnya ada titik pusat. Kalau kita tarik dua garis dari tengah ke tepi lingkaran... [pauses] sudut yang terbentuk di tengah itulah yang disebut sudut pusat.

      [amused] Actually, it's like cutting a cake from the center. You know what I mean? The angle of that slice IS the central angle.

      [thoughtful] Alright, now... how about sudut keliling?

      Here's the thing... kalau sudut keliling, titik sudutnya ada di GARIS TEPI lingkaran. Not in the center, but on the edge.

      [excited] But here's where it gets REALLY interesting...

      Ada hubungan khusus antara sudut pusat dan sudut keliling. [whispers] And this is the key insight...

      [thoughtful] Sudut keliling itu SELALU setengah dari sudut pusat. Always. [exhales] So if the central angle is 80 degrees... the inscribed angle is 40 degrees. Simple, right?

      ---

      ## Natural Speech Patterns Example (English)

      [curious] Okay, so... what if I told you that the heaviest thing in the universe... is also the smallest?

      [thoughtful] Wait, that sounds contradictory, right? But... that's exactly what happens with black holes.

      [excited] They're MASSIVE in weight... [exhales] yet their size can be smaller than a city! 

      [reassuring] Now, I know this feels mind-bending at first. But let's break it down step by step, okay?

      [whispers] Here's the secret...

      [thoughtful] When a massive star collapses... it doesn't just shrink. It actually falls into ITSELF. [pauses] The gravity becomes SO strong that not even LIGHT can escape.

      [laughs] It's like... the universe's ultimate prank, you know? The heaviest thing hiding in the tiniest space!

      [intrigued] Actually, let me rephrase that. [exhales] It's not just heavy—it's infinitely dense. Every bit of that star's mass is squeezed into... well, basically a point.

      [thoughtful] So... does that make sense? The mass is still there, but the space it occupies is... gone.
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
      3. **RICH EMOTIONS** - Use varied audio tags throughout: [curious], [excited], [thoughtful], [intrigued], [amused], [reassuring], [surprised], [whispers], [laughs], [sighs], [exhales], [inhales], [pauses]
      4. **NATURAL SPEECH PATTERNS** - Use conversational fillers ("so...", "you know", "actually", "okay?"), self-corrections, thinking aloud, rhetorical questions, verbal signposts
      5. **CREATIVE PUNCTUATION** - Use ellipses (...) for thinking pauses, CAPS for emphasis, em-dashes for interruptions
      6. **BREATHING** - Use [exhales] after complex explanations, [inhales] before new thoughts
      7. **CONTRACTIONS** - Use "it's", "don't", "we're" for natural flow
      8. **Audio-friendly** - Spell out numbers, describe visuals conversationally, no markdown
      9. **Language**: ${locale}
      10. **Title reference**: Use "${title}" naturally in the content
      11. **Format**: Plain text with audio tags, suitable for direct TTS
      12. **Line breaks**: Between major sections for natural pauses
      13. **NO markdown, NO headers in output** - Just the script text
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
