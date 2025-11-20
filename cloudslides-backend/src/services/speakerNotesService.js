const anthropic = require('../config/claude');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const path = require('path');

class SpeakerNotesService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../generated/notes');
  }

  async generateSpeakerNotes(filePath, options = {}) {
    try {
      console.log('📄 Starting speaker notes generation for:', filePath);

      // Verify file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error('File not found: ' + filePath);
      }

      // Extract content from file
      console.log('📖 Extracting content from document...');
      const content = await this.extractContentFromFile(filePath);

      if (!content || content.trim().length === 0) {
        throw new Error('No text content could be extracted from the file');
      }

      console.log(`✅ Extracted ${content.length} characters of content`);

      // Generate speaker notes with Claude
      console.log('🤖 Generating speaker notes with Claude AI...');
      const notes = await this.generateNotesWithClaude(content, options);

      console.log('✅ Speaker notes generated successfully');

      // Save as formatted document
      console.log('💾 Saving notes as document...');
      const fileInfo = await this.saveNotesAsDocument(notes, options);

      console.log('✅ Notes saved:', fileInfo.filename);

      return fileInfo;
    } catch (error) {
      console.error('❌ Speaker notes generation error:', error);
      throw error;
    }
  }

  async extractContentFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    console.log('File extension:', ext);

    try {
      switch (ext) {
        case '.pdf':
          return await this.extractFromPDF(filePath);
        case '.pptx':
          return await this.extractFromPPTX(filePath);
        case '.docx':
          return await this.extractFromDOCX(filePath);
        case '.txt':
          return await fs.readFile(filePath, 'utf-8');
        default:
          throw new Error(`Unsupported file type: ${ext}. Supported types: PDF, PPTX, DOCX, TXT`);
      }
    } catch (error) {
      console.error('Content extraction error:', error);
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }

  async extractFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);

      if (!data.text || data.text.trim().length === 0) {
        throw new Error('PDF appears to be empty or contains only images');
      }

      return data.text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF. The PDF may be scanned or image-based.');
    }
  }

  async extractFromPPTX(filePath) {
    try {
      const zip = new AdmZip(filePath);
      const slideEntries = zip.getEntries().filter(entry =>
        entry.entryName.startsWith('ppt/slides/slide') &&
        entry.entryName.endsWith('.xml') &&
        !entry.entryName.includes('_rels')
      );

      if (slideEntries.length === 0) {
        throw new Error('No slides found in PPTX file');
      }

      let allText = '';
      let slideNumber = 0;

      for (const entry of slideEntries) {
        slideNumber++;
        const content = entry.getData().toString('utf8');

        // Extract text from XML
        const textMatches = content.match(/<a:t>([^<]+)<\/a:t>/g);

        if (textMatches) {
          allText += `\n--- Slide ${slideNumber} ---\n`;
          textMatches.forEach(match => {
            const text = match.replace(/<\/?a:t>/g, '').trim();
            if (text) {
              allText += text + '\n';
            }
          });
        }
      }

      if (!allText || allText.trim().length === 0) {
        throw new Error('No text content found in PPTX slides');
      }

      return allText;
    } catch (error) {
      console.error('PPTX extraction error:', error);
      throw new Error('Failed to extract text from PPTX: ' + error.message);
    }
  }

  async extractFromDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });

      if (!result.value || result.value.trim().length === 0) {
        throw new Error('No text content found in DOCX file');
      }

      return result.value;
    } catch (error) {
      console.error('DOCX extraction error:', error);
      throw new Error('Failed to extract text from DOCX: ' + error.message);
    }
  }

  async generateNotesWithClaude(content, options) {
    const prompt = this.buildSpeakerNotesPrompt(content, options);

    try {
      console.log('🔑 Using Anthropic API...');
      console.log('📝 Prompt length:', prompt.length, 'characters');

      // Use Haiku for speed and reliability
      const model = 'claude-3-haiku-20240307';

      const message = await anthropic.messages.create({
        model: model,
        max_tokens: 4096,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      });

      console.log('✅ Claude API response received');
      console.log('📊 Response length:', message.content[0].text.length);

      const responseText = message.content[0].text;
      return this.parseNotesResponse(responseText);

    } catch (error) {
      console.error('❌ Claude API error:', {
        name: error.name,
        message: error.message,
        status: error.status,
        type: error.type
      });
      throw new Error('Failed to generate notes with AI: ' + error.message);
    }
  }

  buildSpeakerNotesPrompt(content, options) {
    const { style = 'professional', detail = 'medium', audience = 'general' } = options;

    // Truncate content if too long (keep first 15000 chars)
    const truncatedContent = content.length > 15000
      ? content.substring(0, 15000) + '\n\n[Content truncated...]'
      : content;

    return `You are an expert public speaking coach. Analyze this presentation/document content and create comprehensive speaker notes.

DOCUMENT CONTENT:

${truncatedContent}

REQUIREMENTS:

- Style: ${style}
- Detail Level: ${detail}
- Target Audience: ${audience}

CREATE SPEAKER NOTES WITH THESE SECTIONS:

1. Opening Hook - Attention-grabbing introduction
2. Key Points - Main talking points for each section
3. Transitions - Smooth segues between topics
4. Timing Suggestions - How long to spend on each section
5. Delivery Tips - Tone, pace, emphasis
6. Closing Statement - Memorable conclusion

IMPORTANT: Respond ONLY with a valid JSON object in this EXACT format (no markdown, no code blocks):

{
  "title": "Presentation Title",
  "estimatedDuration": "15-20 minutes",
  "sections": [
    {
      "slideNumber": 1,
      "slideTitle": "Introduction",
      "speakerNotes": "Start by greeting the audience warmly. Introduce yourself and establish credibility on this topic.",
      "keyPoints": ["Greeting", "Self-introduction", "Topic overview"],
      "timing": "2 minutes",
      "deliveryTips": "Speak slowly, make eye contact, smile"
    },
    {
      "slideNumber": 2,
      "slideTitle": "Main Point 1",
      "speakerNotes": "Detailed talking points for this section...",
      "keyPoints": ["Point A", "Point B", "Point C"],
      "timing": "3 minutes",
      "deliveryTips": "Use hand gestures, pause for emphasis"
    }
  ],
  "openingHook": "Start with a compelling question or statistic that grabs attention",
  "closingStatement": "End with a powerful call-to-action or memorable quote",
  "overallTips": ["Maintain energy throughout", "Use stories and examples", "Engage with questions"]
}

Generate comprehensive, actionable speaker notes now:`;
  }

  parseNotesResponse(responseText) {
    try {
      // Remove markdown code blocks
      let cleaned = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      // Find JSON object
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON object found in response');
      }

      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.sections || !Array.isArray(parsed.sections)) {
        throw new Error('Invalid notes structure: missing sections array');
      }

      return parsed;
    } catch (error) {
      console.error('Parse error:', error);
      console.error('Response text:', responseText.substring(0, 500));
      throw new Error('Failed to parse speaker notes from AI response');
    }
  }

  async saveNotesAsDocument(notes, options) {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      // Create formatted text document
      let document = '';
      document += '═══════════════════════════════════════════════════════════════\n';
      document += `   SPEAKER NOTES: ${notes.title || 'Presentation'}\n`;
      document += '═══════════════════════════════════════════════════════════════\n';
      document += `Estimated Duration: ${notes.estimatedDuration || 'N/A'}\n`;
      document += `Style: ${options.style || 'Professional'}\n`;
      document += '═══════════════════════════════════════════════════════════════\n\n';

      // Opening Hook
      document += '🎯 OPENING HOOK\n';
      document += '───────────────────────────────────────────────────────────────\n';
      document += `${notes.openingHook || 'Start with an engaging introduction'}\n\n`;

      // Sections
      document += '📋 DETAILED NOTES BY SECTION\n';
      document += '═══════════════════════════════════════════════════════════════\n\n';

      if (notes.sections && notes.sections.length > 0) {
        notes.sections.forEach((section, index) => {
          document += `SECTION ${section.slideNumber || index + 1}: ${section.slideTitle || 'Untitled'}\n`;
          document += `⏱️  Timing: ${section.timing || 'N/A'}\n`;
          document += '───────────────────────────────────────────────────────────────\n';
          document += `${section.speakerNotes || 'No notes provided'}\n\n`;

          if (section.keyPoints && section.keyPoints.length > 0) {
            document += '📌 Key Points:\n';
            section.keyPoints.forEach(point => {
              document += `   • ${point}\n`;
            });
            document += '\n';
          }

          if (section.deliveryTips) {
            document += `💡 Delivery Tip: ${section.deliveryTips}\n`;
          }

          document += '\n═══════════════════════════════════════════════════════════════\n\n';
        });
      }

      // Closing Statement
      document += '🎤 CLOSING STATEMENT\n';
      document += '───────────────────────────────────────────────────────────────\n';
      document += `${notes.closingStatement || 'End with a strong conclusion'}\n\n`;

      // Overall Tips
      if (notes.overallTips && notes.overallTips.length > 0) {
        document += '✨ OVERALL PRESENTATION TIPS\n';
        document += '───────────────────────────────────────────────────────────────\n';
        notes.overallTips.forEach(tip => {
          document += `   ✓ ${tip}\n`;
        });
        document += '\n';
      }

      document += '═══════════════════════════════════════════════════════════════\n';
      document += 'Generated by CloudSlides AI Speaker Notes\n';
      document += '═══════════════════════════════════════════════════════════════\n';

      // Save as text file
      const filename = `speaker_notes_${Date.now()}.txt`;
      const filepath = path.join(this.outputDir, filename);

      await fs.writeFile(filepath, document, 'utf-8');

      return {
        filename,
        filepath,
        url: `/api/speaker-notes/download/${filename}`,
        notes,
      };
    } catch (error) {
      console.error('Save notes error:', error);
      throw new Error('Failed to save speaker notes: ' + error.message);
    }
  }
}

module.exports = new SpeakerNotesService();
