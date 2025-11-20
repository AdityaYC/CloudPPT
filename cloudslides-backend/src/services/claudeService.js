const anthropic = require('../config/claude');

class ClaudeService {
  async generatePresentationStructure(topic, mode, additionalContext = {}) {
    const prompt = this.buildPrompt(topic, mode, additionalContext);

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', // Working Claude Sonnet model for this API key
        max_tokens: 2000, // Reduced for faster response
        temperature: 0.7, // Faster, more focused responses
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText = message.content[0].text;
      return this.parseClaudeResponse(responseText);
    } catch (error) {
      console.error('Claude API Error:', error);
      
      // Provide more specific error messages
      if (error.status === 401) {
        throw new Error('Invalid Claude API key. Please check your ANTHROPIC_API_KEY in .env');
      } else if (error.status === 429) {
        throw new Error('Claude API rate limit exceeded. Please try again later.');
      } else if (error.message) {
        throw new Error(`Claude API error: ${error.message}`);
      } else {
        throw new Error('Failed to generate presentation structure. Check Claude API configuration.');
      }
    }
  }

  buildPrompt(topic, mode, context) {
    const modeInstructions = {
      investor: 'Create a compelling investor pitch deck with problem, solution, market size, business model, traction, team, and ask slides.',
      professional: 'Create a professional business presentation with clear structure, data-driven insights, and actionable conclusions.',
      educational: 'Create an educational presentation that teaches concepts progressively with examples and interactive elements.',
      creative: 'Create a creative, visually-driven presentation with bold ideas and engaging storytelling.',
      fun: 'Create a fun, visually-driven presentation with bold ideas, engaging storytelling, and playful elements.',
      minimalist: 'Create a minimalist presentation with clean design, focused messaging, and maximum impact per slide.',
      hackathon: 'Create a fast-paced hackathon pitch with problem, solution, demo, tech stack, and impact slides.',
    };

    // Simplified, faster prompt
    return `Create a presentation structure for: ${topic}

Mode: ${mode}
${context.audience ? `Audience: ${context.audience}` : ''}
${context.duration ? `Duration: ${context.duration} minutes` : ''}
${context.keyPoints ? `Key Points: ${context.keyPoints.join(', ')}` : ''}

Generate 8 slides ONLY. Respond with ONLY this JSON array, no other text:

[
  {
    "slideNumber": 1,
    "type": "title",
    "title": "Main Title (max 6 words)",
    "content": "Subtitle",
    "bulletPoints": [],
    "notes": ""
  },
  {
    "slideNumber": 2,
    "type": "content",
    "title": "Slide Title",
    "content": "",
    "bulletPoints": ["Point 1", "Point 2", "Point 3"],
    "notes": ""
  }
]

Keep it SHORT and FOCUSED. Generate now:`;
  }

  parseClaudeResponse(responseText) {
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^[^[{]*/g, '') // Remove any text before the JSON array
        .replace(/[^}\]]*$/g, '') // Remove any text after the JSON array
        .trim();
      
      const slides = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(slides)) {
        throw new Error('Response is not an array');
      }

      if (slides.length === 0) {
        throw new Error('No slides generated');
      }

      // Validate and clean up slides
      return slides.map((slide, index) => ({
        slideNumber: slide.slideNumber || index + 1,
        type: slide.type || 'content',
        title: (slide.title || '').substring(0, 100), // Limit title length
        content: slide.content || '',
        bulletPoints: (slide.bulletPoints || []).map(bp => String(bp).substring(0, 150)), // Limit bullet length
        notes: slide.notes || '',
      }));
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
      console.error('Response text:', responseText.substring(0, 500));
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  async enhanceSlideContent(slideContent, context) {
    const prompt = `Enhance this presentation slide content to be more engaging and impactful:

SLIDE TITLE: ${slideContent.title}
CURRENT CONTENT: ${slideContent.content}
BULLET POINTS: ${slideContent.bulletPoints?.join(', ') || 'None'}

Make it more ${context.tone || 'professional'} and ${context.style || 'compelling'}. Keep it concise but powerful.

Respond with JSON:
{
  "title": "Enhanced title",
  "content": "Enhanced main content",
  "bulletPoints": ["Enhanced point 1", "Enhanced point 2", "Enhanced point 3"]
}`;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      let responseText = message.content[0].text;
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Enhancement error:', error);
      return slideContent; // Return original if enhancement fails
    }
  }
}

module.exports = new ClaudeService();

