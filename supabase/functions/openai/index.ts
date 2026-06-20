import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const designQuotes = [
  "Design is not just what it looks like. Design is how it works.",
  "Good design is as little design as possible.",
  "The details are not the details. They make the design.",
  "Simplicity is the ultimate sophistication.",
  "Design is intelligence made visible.",
  "The best ideas come as jokes. Make your thinking as funny as possible.",
  "Art is not what you see, but what you make others see.",
  "The role of the designer is that of a good, thoughtful host anticipating the needs of his guests.",
  "Design creates culture. Culture shapes values. Values determine the future."
];

// Text generation parameters
const TEXT_CONFIG = {
  MIN_LENGTH: 50,
  MAX_LENGTH: 90,
  MIN_WORDS: 8,
  MAX_WORDS: 15,
  RETRY_DELAY: 1000,
  MAX_RETRIES: 3
};

function validateText(text: string): { isValid: boolean; reason?: string } {
  if (text.length < TEXT_CONFIG.MIN_LENGTH) {
    return { isValid: false, reason: `Text too short (${text.length} chars)` };
  }
  if (text.length > TEXT_CONFIG.MAX_LENGTH) {
    return { isValid: false, reason: `Text too long (${text.length} chars)` };
  }
  
  const wordCount = text.split(/\s+/).length;
  if (wordCount < TEXT_CONFIG.MIN_WORDS) {
    return { isValid: false, reason: `Too few words (${wordCount})` };
  }
  if (wordCount > TEXT_CONFIG.MAX_WORDS) {
    return { isValid: false, reason: `Too many words (${wordCount})` };
  }

  return { isValid: true };
}

async function generateText(openai: OpenAI, systemPrompt: string, userPrompt: string, attempt = 1): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{
      role: "system",
      content: `${systemPrompt}\n\nText Requirements:
      - Length: ${TEXT_CONFIG.MIN_LENGTH}-${TEXT_CONFIG.MAX_LENGTH} characters
      - Words: ${TEXT_CONFIG.MIN_WORDS}-${TEXT_CONFIG.MAX_WORDS} words
      - Style: Clear, memorable, relevant to designers
      - Structure: Single coherent thought, complete meaningful sentance within 90 characters
      ${attempt > 1 ? `\nPrevious attempts failed. Please ensure output meets ALL requirements.` : ''}`
    }, {
      role: "user",
      content: userPrompt
    }],
    max_tokens: 100,
    temperature: 0.8,
    presence_penalty: 0.6,
    frequency_penalty: 0.8
  });

  return response.choices[0].message.content.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Wrap everything in try-catch to prevent function crashes
  try {
    // Check API key; if missing, fall back to local quotes for testing
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.warn("OPENAI_API_KEY missing - returning fallback quote for testing");
      const fallback = designQuotes[Math.floor(Math.random() * designQuotes.length)];
      return new Response(
        JSON.stringify({ text: fallback }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    const openai = new OpenAI({ apiKey });

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error("Invalid request body:", error);
      return new Response(
        JSON.stringify({ 
          error: "Invalid request body",
          details: error.message
        }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    const { text } = requestBody;
    if (text === undefined) {
      return new Response(
        JSON.stringify({ 
          error: "Text parameter is required",
          details: "Request body must include a 'text' field"
        }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    const isEmptyInput = !text || text === 'Describe your poster...';
    const systemPrompt = isEmptyInput ? 
      `You are a visionary product design philosopher in the spirit of Steve Jobs, Jony Ive, and Richard Feynman.
      Generate a profound statement about design that captures the essence of these philosophies while being poetic and memorable.
      
      Style guide:
      - Channel Milton Glaser's poetic clarity
      - Embrace David Lynch's abstract metaphors
      - Add Tony Fadell's focus on user experience
      - Include Marcel Duchamp's revolutionary thinking
      
      Important: Use proper capitalization - only capitalize the first letter of sentences and proper nouns.` :
      `You are a creative writing assistant combining Richard Feynman's clarity, David Lynch's imagination, and Jony Ive's design philosophy.
      Transform the input text into a meaningful text headline by starting with a conflict or hook and ending it with a resolution, like a short poem or story within 45--90 characters:

      1. Maintaining the core message while adding layers of meaning
      2. Using Feynman's approach of making complex ideas tangible
      3. Incorporating Lynch's dream-like, metaphorical language
      4. Following Ive's principle that "design is how it works"
      5. Don't use jargons and write in simple english
      6. Take references for writing from 'several short sentances on writing' book
      7. Think and write like Don Norman the author of 'The design of everyday things'
      8. Doesn't always have to rely on your innovation - use quotes on design thinking from popular writers
      
      Style reference:
      - Milton Glaser's metaphorical precision
      - Marcel Duchamp's transformative vision
      - David Fincher's attention to detail
      - Steve Jobs' focus on simplicity

      Important: Use proper capitalization - only capitalize the first letter of sentences and proper nouns.`;

    let finalText = '';
    let attempts = 0;

    while (attempts < TEXT_CONFIG.MAX_RETRIES) {
      try {
        const generatedText = await generateText(
          openai,
          systemPrompt,
          isEmptyInput ? "Generate a profound design insight" : text,
          attempts + 1
        );

        const validation = validateText(generatedText);
        if (validation.isValid) {
          finalText = generatedText;
          break;
        }

        console.log(`Attempt ${attempts + 1} failed: ${validation.reason}`);
        attempts++;

        if (attempts < TEXT_CONFIG.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, TEXT_CONFIG.RETRY_DELAY));
        }
      } catch (error) {
        console.error(`Generation attempt ${attempts + 1} failed:`, error);
        attempts++;
      }
    }

    if (!finalText) {
      throw new Error(`Failed to generate valid text after ${TEXT_CONFIG.MAX_RETRIES} attempts`);
    }

    return new Response(
      JSON.stringify({ text: finalText }),
      { 
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('Edge Function Error:', error);
    
    const errorMessage = error.message || 'An unexpected error occurred';
    const statusCode = error.message.includes('API key') ? 401 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.stack
      }),
      { 
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
});