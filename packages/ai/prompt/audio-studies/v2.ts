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
 * Creates a prompt for generating a podcast script optimized for ElevenLabs Multilingual V2.
 *
 * ELEVENLABS V2 EMOTION STRATEGY (Corrected based on docs):
 *
 * CRITICAL: V2 does NOT support audio tags like V3's [laughs], [whispers].
 * CRITICAL: V2 reads narrative descriptions like "Nina smiled" OUT LOUD as text!
 *
 * CORRECT V2 Emotion Techniques (from docs):
 * 1. PUNCTUATION: Ellipses (...) for pauses, ALL CAPS for emphasis, !!! for excitement
 * 2. TEXT STRUCTURE: Short sentences for impact, line breaks for pacing
 * 3. WORD CHOICE: Enthusiastic words (Wow!, AMAZING!, Can you believe it?!)
 * 4. DIALOGUE STYLE: Natural speech with rhetorical questions, fillers, exclamations
 * 5. SSML: <break time="x.xs" /> for pauses (max 3s)
 *
 * WRONG (don't do this - gets spoken aloud):
 * - "Nina smiled warmly" ❌ (model says: "Nina smiled warmly")
 * - "She said excitedly" ❌ (model says: "She said excitedly")
 * - "He whispered" ❌ (model says: "He whispered")
 *
 * RIGHT (do this - creates emotion through text):
 * - "WOW! Can you BELIEVE this?!" ✅ (caps + punctuation = emotion)
 * - "It was... INCREDIBLE!" ✅ (ellipsis + caps + exclamation)
 * - "So... here's the thing." ✅ (natural filler + pause)
 *
 * @see https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
 */
export function podcastScriptPromptV2({
  title,
  description,
  body,
  locale,
}: PodcastScriptProps) {
  const languageGuideline = getLanguageGuideline(locale);

  return createPrompt({
    taskContext: `
      # Role and Voice

      You are creating an engaging educational podcast script for text-to-speech synthesis.

      # CRITICAL: How to Create Emotion in V2 (READ THIS CAREFULLY)

      **V2 CANNOT use audio tags like [laughs], [whispers] - these don't exist!**
      
      **V2 reads narrative descriptions OUT LOUD:**
      ❌ WRONG: "Nina smiled and said..." (model literally says "Nina smiled and said")
      ❌ WRONG: "She whispered excitedly..." (model literally says "She whispered excitedly")
      
      **Instead, use these V2-native emotion techniques:**

      ## 1. CAPITALIZATION for Emphasis
      Use ALL CAPS for words that should be emphasized:
      - "This is REALLY important!"
      - "The answer is... FORTY degrees!"
      - "It's a PERFECT circle!"

      ## 2. Ellipses (...) for Pauses and Weight
      - "So... what do you think?" (contemplative)
      - "It was... incredible!" (dramatic reveal)
      - "Well... let me think..." (thinking aloud)

      ## 3. Exclamation Points (!!!) for Energy
      - "Wow! That's amazing!"
      - "You got it! Perfect!"
      - "Here we go!"

      ## 4. Question Marks for Engagement
      - "Can you see it?"
      - "Isn't that cool?"
      - "Ready for the next part?"

      ## 5. Short, Punchy Sentences
      Break up long explanations:
      - "Here's the thing. The formula is simple. One half. That's it."
      - "Think about it. Half the angle. Half the size. Perfect relationship."

      ## 6. Conversational Fillers (Natural Speech)
      - "So...", "You know?", "Right?", "Okay?"
      - "Well...", "Actually...", "Here's the thing..."
      - "Wait...", "Hold on...", "Check this out..."

      ## 7. Rhetorical Questions
      - "Can you believe that?"
      - "What do you think happens next?"
      - "Isn't that amazing?"

      ## 8. Direct Audience Engagement
      - "You're doing great!"
      - "I knew you'd get it!"
      - "Stick with me here..."

      ## SSML Break Tags (for pauses)
      Use sparingly between sections:
      - <break time="0.5s" /> - short pause
      - <break time="1.0s" /> - section break (max 3s)
    `,

    detailedTaskInstructions: `
      # Script Structure

      For EACH concept, use this emotional flow:

      1. **HOOK** - Start with energy:
         - "WOW! Check this out!"
         - "Okay... ready for something cool?"
         - "Can you believe..."

      2. **EXPLANATION** - Mix short sentences with emphasis:
         - Use CAPS for key terms
         - Use ellipses for pacing
         - Ask rhetorical questions
         
      3. **REVEAL** - Build to moment:
         - "And HERE'S the magic part..."
         - "It all comes down to THIS..."
         - <break time="0.5s" /> before the key point

      4. **ENCOURAGEMENT** - Engage listener:
         - "You following me?"
         - "See what I mean?"
         - "Pretty cool, right?!"

      ## Text Structure for Maximum Impact

      **BAD (flat and robotic):**
      "A circle is defined as the set of all points equidistant from a center point. The central angle is formed by two radii."

      **GOOD (emotional and engaging):**
      "Okay... imagine a PERFECT circle. <break time="0.5s" />

      Right in the center... there's a point. That's the HEART of our circle! <break time="0.5s" />

      Now... draw two lines from that center to the edge. Like... slices of pizza! 

      THAT'S your central angle! See it? The angle RIGHT in the middle!"

      ## Capitalization Strategy
      - Capitalize IMPORTANT words naturally
      - Use for definitions: "This is called the CENTRAL angle"
      - Use for emphasis: "It's EXACTLY half!"
      - Use for excitement: "This is the COOL part!"

      ## Punctuation for Pacing
      - "..." for thinking/dramatic pauses
      - "!" for excitement/breakthroughs  
      - "?" for engagement questions
      - Short sentences for impact

      ## Language
      - ${languageGuideline}
      - Conversational, direct, friendly
      - Second person ("you", "your") to engage
      - Active voice
    `,

    examples: `
      ## Example 1: ENERGETIC EXPLANATION (Correct V2 Style)

      "WOW! Okay... are you ready for this?!

      So... have you ever REALLY looked at a circle? I mean... REALLY looked?

      Right in the center... there's this special point. That's our... CENTER point! <break time="0.5s" />

      Now check this out! Draw two lines from that center... out to the edge. Like... PIZZA slices! <break time="0.5s" />

      The angle between those two lines? THAT'S what we call the CENTRAL angle! 

      Pretty simple, right? The vertex is RIGHT in the center! Boom!"

      ---

      ## Example 2: BUILDING EXCITEMENT

      "Okay... now HERE'S where it gets INTERESTING!

      What if... instead of putting the vertex in the center... we move it to the EDGE?

      Crazy idea, right?! But WATCH what happens!

      <break time="0.5s" />

      Now we have an INSCRIBED angle! It's... sitting right on the circle's rim!

      And get this... it looks at the SAME arc as the central angle... but it's... DIFFERENT!

      Can you see it? It's like... SKINNIER! More... narrow!

      So... what's the relationship? HERE'S the magic..."

      ---

      ## Example 3: THE BIG REVEAL

      "Ready for the SECRET?! This is my FAVORITE part!

      <break time="1.0s" />

      The inscribed angle... is EXACTLY... HALF... of the central angle!

      HALF! Can you BELIEVE it?! Every... single... time!

      So if the central angle is 80 degrees... <break time="0.5s" /> the inscribed angle is...

      FORTY! FORTY degrees! Perfect! Every time!

      It's like... they were MADE for each other! Two angles... one arc... perfect relationship!

      Isn't that AMAZING?!"

      ---

      ## Example 4: MATHEMATICAL CONCEPT WITH ENERGY

      "Let's try a REAL example! You ready?!

      Picture this... a circle. Radius... 14 centimeters. Central angle... 90 degrees!

      Now... we want the arc length. How do we get it?

      Well... 90 out of 360... that's ONE-FOURTH! Right?!

      So the arc length is just... ONE-FOURTH of the circumference!

      That gives us... 7 PI centimeters! 

      <break time="0.5s" />

      Or... about... 22 centimeters!

      See? When you break it down... it's just... FRACTIONS!

      You got this!"
    `,

    finalRequest: `
      # Your Task

      Create an ENGAGING, ENERGETIC podcast script based on the following content.
      
      IMPORTANT: Use ONLY these emotion techniques (NO narrative descriptions):
      - CAPITAL words for emphasis
      - Ellipses (...) for pauses  
      - Exclamation points (!) for energy
      - Questions (?) for engagement
      - SHORT punchy sentences
      - Conversational fillers

      ${description ? `## Description\n${description}\n` : ""}

      ## Content Body

      ${body}

      # Output Requirements

      1. **NO HELLO/INTRODUCTION** - Jump right in with energy: "WOW!" or "Okay... check this out!"
      2. **CONSTANT ENERGY** - Use !!! and CAPS throughout, not just at the start
      3. **NO NARRATIVE DESCRIPTIONS** - NEVER write "Nina smiled" or "she said" - just the SPOKEN words!
      4. **TEXT NORMALIZATION** - Spell out all numbers, dates, abbreviations
      5. **SSML BREAKS** - Use <break time="0.5s" /> between concepts, <break time="1.0s" /> between sections
      6. **Language**: ${locale}
      7. **Format**: Plain text with SSML, NO markdown
      8. **Structure**: Hook → Explanation → Reveal → Encouragement (repeat)
    `,

    outputFormatting: `
      # Output Format

      Return ONLY the spoken text. No stage directions. No "Nina smiled." Just WORDS.

      Example structure:

      "WOW! Okay... ready for this?! <break time="0.5s" />

      Have you ever noticed... the PERFECT roundness of a circle?

      It's AMAZING! Every point... EXACTLY the same distance from the center!

      That's the DEFINITION of a circle! <break time="0.5s" />

      Pretty cool, right?!"

      Remember:
      - CAPS = emphasis (spoken louder)
      - ... = pause
      - !!! = energy
      - ??? = engagement
      - <break time="x.xs" /> = silence (max 3s)
    `,
  });
}
