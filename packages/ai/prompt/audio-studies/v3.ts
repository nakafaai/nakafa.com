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
 * ELEVENLABS V3 BEST PRACTICES (from https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3):
 * - Audio tags control emotion and can be placed BEFORE or AFTER text
 * - Tag combinations work: [excited] [slower] before important content
 * - Ellipses (...) create pauses and weight
 * - Capitalization adds emphasis
 * - Text structure strongly influences output - use line breaks between emotional shifts
 * - NO SSML break tags - use audio tags and punctuation instead
 * - Match tags to voice character (Nina is warm/educational)
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

      # ElevenLabs V3 Audio Tags - MANDATORY USAGE

      ## Tag Placement Rules (CRITICAL - FOLLOW EXACTLY)
      
      **Tags can appear BEFORE or AFTER text - use BOTH positions:**
      - BEFORE: "[curious] What happens when..."
      - AFTER: "That's amazing! [excited]"
      - INLINE: "Bayangkan [whispers] sebuah lingkaran..."
      
      **Tag combinations - use up to 2 tags together:**
      - [excited] [slower] - Before important numbers or answers
      - [thoughtful] [sighs] - When explaining difficult concepts
      - [reassuring] [warmly] - Encouraging the listener
      
      ## Required Audio Tags (MUST USE throughout script)
      
      ### Emotion Tags (use 15-20+ times throughout script)
      - [curious] - Posing questions, introducing mysteries
      - [excited] - Breakthrough moments, amazing facts  
      - [thoughtful] - Deep explanations, working through concepts
      - [intrigued] - Interesting discoveries
      - [amused] - Light humor, relatable moments
      - [reassuring] - When content is challenging
      - [surprised] - Unexpected connections
      - [determined] - Solving problems step by step
      - [happy] - Joyful discoveries
      - [impressed] - Praising good understanding
      - [mischievously] - Playful challenges
      - [warmly] - Friendly, encouraging moments
      
      ### Delivery Tags (use 10-15+ times)
      - [laughs] / [chuckles] - Genuine warmth
      - [sighs] - Reflecting on difficulty or common mistakes
      - [whispers] - Emphasis, "did you know" moments, side notes
      - [exhales] - After explaining something complex
      - [inhales] - Before new thoughts
      - [pauses] - Dramatic pause before key point
      - [slower] - Before important numbers or answers
      - [faster] - For excitement or listing
      
      ## PARAGRAPH STRUCTURE - MAX 2 SENTENCES
      
      **CRITICAL:** Every paragraph MUST contain maximum 2 sentences only. This creates natural breathing pauses and better audio pacing.
      
      **CORRECT (2 sentences max per paragraph):**
      
      [curious] Okay... pernahkah kamu memperhatikan potongan pizza [whispers] yang ditarik dari tengah?
      
      [thoughtful] So... di balik bentuk sederhana itu, ada rahasia matematika yang SANGAT menarik.
      
      [exhales] Now, let's start with sudut pusat.
      
      Bayangkan ada lingkaran di depanmu. Tepat di tengahnya ada titik pusat.
      
      [pauses] Kalau kita tarik dua garis dari tengah ke tepi... sudut yang terbentuk di tengah itulah yang disebut sudut pusat.
      
      [amused] You know what? It's like cutting a cake from the center.
      
      [excited] The angle of that slice IS the central angle!
      
      **INCORRECT (too many sentences in one paragraph):**
      ❌ Bayangkan ada lingkaran di depanmu. Tepat di tengahnya ada titik pusat. Kalau kita tarik dua garis dari tengah ke tepi, sudut yang terbentuk di tengah itulah yang disebut sudut pusat. Ini sangat penting untuk dipahami.
      
      ## RICH INTONATION - NAIK TURUN NADA
      
      **INTONASI HARUS RICH DAN DINAMIS** - Suara harus naik turun sesuai konteks:
      
      **Nada Naik (Rising Intonation):**
      - [curious] + pertanyaan: "Apa jadinya kalau...?"
      - [excited] + penemuan: "WOW! Ini dia rahasianya!"
      - [surprised] + kejutan: "Nah! Sudut yang terbentuk..."
      - [intrigued] + misteri: "Tapi tunggu... ada yang lebih menarik!"
      - [questioning] + intonasi naik di akhir: "Kamu paham, kan?"
      
      **Nada Turun (Falling Intonation):**
      - [thoughtful] + penjelasan: "Jadi... hubungannya adalah..."
      - [reassuring] + keyakinan: "Tenang... kamu pasti bisa."
      - [exhales] + selesai menjelaskan: "Itulah sudut pusat."
      - [warmly] + penutup: "Kamu sudah menguasai ini dengan sangat baik."
      - [confident] + fakta: "Besarnya pasti EMPAT PULUH derajat."
      
      **Nada Flat → Naik (Flat to Rising):**
      - "Panjangnya adalah... [slower] EMPAT PULUH derajat?" (flat then up for emphasis)
      - "Jawabannya adalah... [pauses] ENAM PULUH?" 
      
      **Tag Density Requirements**
      
      **MANDATORY:** Use audio tags EVERY 2-3 SENTENCES, not just at paragraph starts.
      
      ## Tag Combination Examples
      
      **From ElevenLabs docs - USE THESE PATTERNS:**
      - [excited] "And guess what?!" 
      - [whispers] "Here's the secret..."
      - [laughs] "That's actually funny!"
      - [reassuring] + [warmly] "Don't worry, you've got this."
      - [thoughtful] + [sighs] "This part is tricky..."
      - [surprised] + [excited] "Wait... it actually WORKS!"
      - [excited] + [slower] "The answer is... FORTY degrees!"
      
      ## Punctuation for Pacing
      - Ellipses (...) for thoughtful pauses and weight
      - Em-dashes (—) for quick interruptions or additions  
      - ALL CAPS for emphasis on key terms
      - Question marks for engagement
      - Line breaks between emotional shifts (this strongly influences V3 output)

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
      - Read formulas conversationally: "angle ACB equals half of angle AOB"
      - Describe visual elements verbally
      - Use "and" not "&"
      - Write abbreviations on first use
      - Use contractions ("it's", "don't", "we're") for natural flow
      - Use line breaks between major sections for natural pauses
      - NO SSML break tags - use audio tags and punctuation instead
    `,

    examples: `
      ## Example Script - MAX 2 SENTENCES PER PARAGRAPH (Based on ElevenLabs V3 Docs)

      [curious] Okay... pernahkah kamu memperhatikan potongan pizza yang ditarik dari tengah?

      [thoughtful] So... di balik bentuk sederhana itu, ada rahasia matematika yang SANGAT menarik.

      [exhales] Now, let's start with sudut pusat.

      Bayangkan ada lingkaran di depanmu. Tepat di tengahnya ada titik pusat.

      [pauses] Kalau kita tarik dua garis dari tengah ke tepi... sudut yang terbentuk di tengah itulah yang disebut sudut pusat.

      [amused] You know what? It's like cutting a cake from the center.

      [excited] The angle of that slice IS the central angle!

      [thoughtful] Alright, now... how about sudut keliling?

      Here's the thing... kalau sudut keliling, titik sudutnya ada di GARIS TEPI lingkaran.

      [curious] Not in the center, but on the edge, right?

      [excited] But here's where it gets REALLY interesting!

      Ada hubungan khusus antara keduanya. [whispers] And this is the key insight...

      [thoughtful] Sudut keliling itu SELALU setengah dari sudut pusat.

      [confident] Always! So if central angle is 80 degrees... [slower] the inscribed angle is 40 degrees.

      ---

      ## Expressive Monologue Example - MAX 2 SENTENCES + RICH INTONATION

      [curious] Okay, you are NOT going to believe this!

      You know how I've been stuck on that problem? Like, staring for HOURS?

      [frustrated] I was seriously about to give up. Start over completely.

      [surprised] But then! Last night, it just... clicked!

      [excited] And it was like... the FLOODGATES opened! Suddenly I knew exactly what to do!

      [laughs] I stayed up till 3 AM working! Just typing like crazy!

      [warmly] And it's... it's GOOD! Really good, you know?

      [excited] I am so incredibly PUMPED right now! Can't wait to show you!

      ---

      ## Educational with Maximum Emotion - RICH INTONATION

      [curious] So... what do you think the answer is? [questioning] Can you guess?

      [thoughtful] Let's work through this together. Step by step, okay?

      The formula is one-half times the central angle. Very simple, right?

      [excited] And that means... [slower] the answer is forty degrees!

      [laughs] See? You got it! Knew you could do it!

      [whispers] Here's a secret... most students forget to divide by two.

      [reassuring] Don't worry if you made that mistake. It's super common, okay?

      [mischievously] Now... are you ready for the next challenge? Think you can handle it?

      [warmly] I know you can do this! You've got this!
    `,

    finalRequest: `
      # Your Task

      Create an engaging podcast script based on the following content. 
      
      IMPORTANT: The script structure MUST follow the content structure exactly. If the content has multiple sections, your script must have matching sections.

      ${
        description
          ? `## Description
${description}
`
          : ""
      }

      ## Content Body (MUST follow this structure exactly)

      ${body}

      # Output Requirements

      1. **NO HELLO/INTRODUCTION** - Start with content immediately
      2. **STRUCTURE MATCH** - Script sections align with content sections
      3. **MAXIMUM TAG DENSITY** - Use audio tags EVERY 2-3 SENTENCES throughout entire script
      4. **TAG PLACEMENT** - Place tags at beginning, middle, OR end of sentences (not just paragraph starts)
      5. **TAG COMBINATIONS** - Use up to 2 tags together: [excited] [slower], [thoughtful] [sighs], [reassuring] [warmly]
      6. **EMPHASIS** - Use CAPS for key words, ellipses (...) for pauses, "you know?", "right?" for engagement
      7. **TEXT STRUCTURE** - Use line breaks between emotional shifts (this strongly influences V3 output)
      8. **NATURAL SPEECH** - Use fillers ("so...", "you know", "actually"), self-corrections, thinking aloud
      9. **BREATHING** - Use [exhales] after complex explanations, [inhales] before new thoughts
      10. **Audio-friendly** - Spell out numbers, describe visuals conversationally, no markdown
      11. **Language**: ${locale}
      12. **Title reference**: Use "${title}" naturally in the content
      13. **Format**: Plain text with audio tags, suitable for direct TTS
      14. **Line breaks**: Between emotional shifts (docs say this strongly influences output)
      15. **NO markdown, NO headers in output** - Just the script text
      16. **NO SSML tags** - Only ElevenLabs V3 audio tags in square brackets
      17. **Language style**: ${languageGuideline}
      18. **MAX 2 SENTENCES PER PARAGRAPH** - Every paragraph must be 1-2 sentences only, then line break
      19. **RICH INTONATION** - Nada harus naik untuk pertanyaan/kejutan ([curious], [excited], [surprised]), turun untuk penjelasan/keyakinan ([thoughtful], [reassuring], [confident])
      
      ## Output Verification Checklist (MUST CHECK BEFORE OUTPUT):
      - [ ] Every paragraph has MAXIMUM 2 sentences (critical!)
      - [ ] Rich intonation variety: nada naik untuk pertanyaan/kejutan, turun untuk penjelasan
      - [ ] At least 15-20 emotion tags used ([curious], [excited], [thoughtful], etc.)
      - [ ] At least 10-15 delivery tags used ([laughs], [whispers], [sighs], etc.)
      - [ ] Tags appear every 2-3 sentences (not just paragraph starts)
      - [ ] Combined tags used 5+ times ([excited] [slower], etc.)
      - [ ] Tags placed at end of sentences 5+ times
      - [ ] Line breaks between major emotional shifts
      - [ ] Ellipses (...) used for pauses (not SSML)
    `,

    outputFormatting: `
      # Output Format

      Return ONLY the script text. No explanations, no markdown headers, no code blocks.

      The script should have audio tags distributed throughout:

      [curious] Opening hook...

      [thoughtful] Main explanation with ellipses for pauses...

      Bayangkan [whispers] sebuah lingkaran di depanmu...

      [excited] Key insight! [exhales]

      [reassuring] Don't worry... [warmly] you've got this.

      Remember:
      - Use [slower] before important numbers or answers
      - Use [faster] for excitement or listing
      - Combine up to 2 tags for maximum effect
      - Place tags at natural emotion shift points
      - Use ... for pauses, NOT SSML break tags
      - Tags can appear at BEGINNING, MIDDLE, or END of sentences
    `,
  });
}
