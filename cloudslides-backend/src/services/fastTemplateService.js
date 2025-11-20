const PptxGenJS = require('pptxgenjs');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs').promises;

class FastTemplateService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../generated');
  }

  async createPresentationFromTemplate(presentationData, templatePath) {
    try {
      const startTime = Date.now();
      console.log('🚀 Starting fast generation...');

      if (!templatePath) {
        // No template - use fast default generation
        return await this.createDefaultPresentation(presentationData);
      }

      // Quick template extraction and generation
      const templateColors = await this.quickExtractColors(templatePath);
      
      // Merge with presentation data
      const finalColors = {
        ...templateColors,
        ...presentationData.colorScheme
      };

      // Fast generation with template colors
      const result = await this.fastGenerate(presentationData, finalColors);
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Generation completed in ${elapsed}ms`);
      
      return result;
    } catch (error) {
      console.error('Fast template error:', error);
      // Fallback to default
      return await this.createDefaultPresentation(presentationData);
    }
  }

  async quickExtractColors(templatePath) {
    try {
      const zip = new AdmZip(templatePath);
      const themeEntry = zip.getEntry('ppt/theme/theme1.xml');
      
      if (!themeEntry) {
        return this.getDefaultColors();
      }

      const themeXml = themeEntry.getData().toString('utf8');
      
      // Quick regex extraction (faster than full XML parsing)
      const colors = {};
      
      // Extract accent colors
      const accentMatch = themeXml.match(/<a:accent1[^>]*>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (accentMatch) colors.primary = accentMatch[1];
      
      const accent2Match = themeXml.match(/<a:accent2[^>]*>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (accent2Match) colors.secondary = accent2Match[1];
      
      const accent3Match = themeXml.match(/<a:accent3[^>]*>[\s\S]*?val="([A-F0-9]{6})"/i);
      if (accent3Match) colors.accent = accent3Match[1];

      return {
        primary: colors.primary || '7c3aed',
        secondary: colors.secondary || 'a78bfa',
        accent: colors.accent || 'ec4899',
        background: 'FFFFFF',
        text: '1f2937'
      };
    } catch (error) {
      console.log('Quick color extraction failed, using defaults');
      return this.getDefaultColors();
    }
  }

  async fastGenerate(presentationData, colors) {
    const pptx = new PptxGenJS();
    
    pptx.author = 'CloudSlides AI';
    pptx.title = presentationData.title;
    pptx.layout = 'LAYOUT_16x9';
    pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 });
    pptx.layout = 'CUSTOM';

    const fonts = presentationData.font || { heading: 'Arial', body: 'Calibri' };

    // Generate all slides quickly
    for (const slideData of presentationData.slides) {
      this.quickCreateSlide(pptx, slideData, colors, fonts);
    }

    const filename = `presentation_${Date.now()}.pptx`;
    const filepath = path.join(this.outputDir, filename);

    await fs.mkdir(this.outputDir, { recursive: true });
    await pptx.writeFile({ fileName: filepath });

    return {
      filename,
      filepath,
      url: `/api/presentations/download/${filename}`,
    };
  }

  quickCreateSlide(pptx, slideData, colors, fonts) {
    const slide = pptx.addSlide();

    if (slideData.type === 'title') {
      // Title slide with gradient header
      slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 2,
        fill: { type: 'solid', color: colors.primary }
      });

      slide.addText(slideData.title || '', {
        x: 0.5, y: 2.5, w: 9, h: 1,
        fontSize: 44, bold: true, color: '000000',
        fontFace: fonts.heading, align: 'center'
      });

      if (slideData.content) {
        slide.addText(slideData.content, {
          x: 0.5, y: 3.8, w: 9, h: 0.8,
          fontSize: 24, color: '333333',
          fontFace: fonts.body, align: 'center'
        });

        slide.addShape('rect', {
          x: 3.5, y: 4.8, w: 3, h: 0.1,
          fill: { type: 'solid', color: colors.accent }
        });
      }
    } else {
      // Content slide
      slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 1,
        fill: { type: 'solid', color: colors.primary }
      });

      slide.addText(slideData.title || '', {
        x: 0.5, y: 0.2, w: 9, h: 0.6,
        fontSize: 32, bold: true, color: 'FFFFFF',
        fontFace: fonts.heading
      });

      let yPos = 1.5;

      if (slideData.content && !slideData.bulletPoints?.length) {
        slide.addText(slideData.content, {
          x: 1, y: yPos, w: 8, h: 1,
          fontSize: 20, color: '1f2937',
          fontFace: fonts.body
        });
        yPos += 1.5;
      }

      if (slideData.bulletPoints?.length > 0) {
        const bullets = slideData.bulletPoints.map(p => ({
          text: p,
          options: { bullet: true, fontSize: 18, color: '1f2937' }
        }));

        slide.addText(bullets, {
          x: 1.2, y: yPos, w: 7.5, h: 3.5,
          fontFace: fonts.body
        });
      }
    }
  }

  async createDefaultPresentation(presentationData) {
    const colors = presentationData.colorScheme || this.getDefaultColors();
    return await this.fastGenerate(presentationData, colors);
  }

  getDefaultColors() {
    return {
      primary: '7c3aed',
      secondary: 'a78bfa',
      accent: 'ec4899',
      background: 'FFFFFF',
      text: '1f2937'
    };
  }
}

module.exports = new FastTemplateService();

