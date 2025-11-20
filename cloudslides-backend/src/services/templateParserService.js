const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');

class TemplateParserService {
  async parseUploadedTemplate(filePath) {
    try {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();

      // Extract template metadata
      const metadata = {
        slideLayouts: [],
        colorScheme: {},
        fonts: {},
        masterSlides: [],
        slideSize: {},
      };

      // Parse presentation.xml for slide size and properties
      const presentationXml = zip.getEntry('ppt/presentation.xml');
      if (presentationXml) {
        const presentationData = await this.parseXML(presentationXml.getData().toString('utf8'));
        
        if (presentationData['p:presentation'] && presentationData['p:presentation']['p:sldSz']) {
          const sldSz = presentationData['p:presentation']['p:sldSz'][0]['$'];
          metadata.slideSize = {
            width: parseInt(sldSz.cx) / 914400, // Convert EMUs to inches
            height: parseInt(sldSz.cy) / 914400,
          };
        }
      }

      // Parse theme colors
      const themeXml = zip.getEntry('ppt/theme/theme1.xml');
      if (themeXml) {
        const themeData = await this.parseXML(themeXml.getData().toString('utf8'));
        metadata.colorScheme = await this.extractColors(themeData);
        metadata.fonts = await this.extractFonts(themeData);
      }

      // Parse slide masters
      zipEntries.forEach((entry) => {
        if (entry.entryName.startsWith('ppt/slideMasters/') && entry.entryName.endsWith('.xml')) {
          metadata.masterSlides.push({
            name: entry.entryName,
            path: entry.entryName,
          });
        }
        
        if (entry.entryName.startsWith('ppt/slideLayouts/') && entry.entryName.endsWith('.xml')) {
          metadata.slideLayouts.push({
            name: entry.entryName,
            path: entry.entryName,
          });
        }
      });

      // Store the template file for reuse
      const templateId = path.basename(filePath, '.pptx');
      
      return {
        templateId,
        originalPath: filePath,
        metadata,
      };
    } catch (error) {
      console.error('Template parsing error:', error);
      throw new Error('Failed to parse template');
    }
  }

  async parseXML(xmlString) {
    const parser = new xml2js.Parser();
    return await parser.parseStringPromise(xmlString);
  }

  async extractColors(themeData) {
    try {
      const colorScheme = themeData['a:theme']?.['a:themeElements']?.[0]?.['a:clrScheme']?.[0];
      
      if (!colorScheme) {
        throw new Error('No color scheme found');
      }

      const colors = {};
      
      // Extract primary colors
      if (colorScheme['a:dk1']) {
        const dk1 = colorScheme['a:dk1'][0];
        if (dk1['a:srgbClr']) {
          colors.text = dk1['a:srgbClr'][0]['$'].val;
        }
      }
      
      if (colorScheme['a:lt1']) {
        const lt1 = colorScheme['a:lt1'][0];
        if (lt1['a:srgbClr']) {
          colors.background = lt1['a:srgbClr'][0]['$'].val;
        }
      }
      
      if (colorScheme['a:accent1']) {
        const accent1 = colorScheme['a:accent1'][0];
        if (accent1['a:srgbClr']) {
          colors.primary = accent1['a:srgbClr'][0]['$'].val;
        }
      }
      
      if (colorScheme['a:accent2']) {
        const accent2 = colorScheme['a:accent2'][0];
        if (accent2['a:srgbClr']) {
          colors.secondary = accent2['a:srgbClr'][0]['$'].val;
        }
      }
      
      if (colorScheme['a:accent3']) {
        const accent3 = colorScheme['a:accent3'][0];
        if (accent3['a:srgbClr']) {
          colors.accent = accent3['a:srgbClr'][0]['$'].val;
        }
      }

      return colors;
    } catch (error) {
      console.error('Color extraction error:', error);
      return {
        primary: '667eea',
        secondary: '764ba2',
        accent: 'ec4899',
        background: 'FFFFFF',
        text: '000000',
      };
    }
  }

  async extractFonts(themeData) {
    try {
      const fontScheme = themeData['a:theme']?.['a:themeElements']?.[0]?.['a:fontScheme']?.[0];
      
      if (!fontScheme) {
        throw new Error('No font scheme found');
      }

      const fonts = {};
      
      if (fontScheme['a:majorFont']) {
        const majorFont = fontScheme['a:majorFont'][0]?.['a:latin']?.[0]?.['$'];
        fonts.heading = majorFont?.typeface || 'Arial';
      }
      
      if (fontScheme['a:minorFont']) {
        const minorFont = fontScheme['a:minorFont'][0]?.['a:latin']?.[0]?.['$'];
        fonts.body = minorFont?.typeface || 'Calibri';
      }

      return fonts;
    } catch (error) {
      console.error('Font extraction error:', error);
      return {
        heading: 'Arial',
        body: 'Calibri',
      };
    }
  }

  async cloneTemplateForGeneration(templatePath, outputPath) {
    try {
      await fs.copyFile(templatePath, outputPath);
      return outputPath;
    } catch (error) {
      console.error('Template cloning error:', error);
      throw new Error('Failed to clone template');
    }
  }
}

module.exports = new TemplateParserService();

