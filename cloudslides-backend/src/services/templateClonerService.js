const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs').promises;
const xml2js = require('xml2js');

class TemplateClonerService {
  async generateFromTemplate(templatePath, slideContents, outputPath) {
    try {
      // Read the template file
      const zip = new AdmZip(templatePath);
      
      // Get all existing slides
      const slideEntries = zip.getEntries().filter(entry => 
        entry.entryName.match(/^ppt\/slides\/slide\d+\.xml$/)
      );

      console.log(`Found ${slideEntries.length} slides in template`);

      // We'll use the first slide as a template and duplicate it
      if (slideEntries.length === 0) {
        throw new Error('Template has no slides');
      }

      const firstSlideEntry = slideEntries[0];
      const firstSlideXml = firstSlideEntry.getData().toString('utf8');

      // Parse the first slide to understand its structure
      const parser = new xml2js.Parser();
      const slideStructure = await parser.parseStringPromise(firstSlideXml);

      // Delete all existing slides
      slideEntries.forEach(entry => {
        zip.deleteFile(entry.entryName);
      });

      // Also delete slide relationship files
      const slideRelEntries = zip.getEntries().filter(entry =>
        entry.entryName.match(/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/)
      );
      slideRelEntries.forEach(entry => {
        zip.deleteFile(entry.entryName);
      });

      // Generate new slides based on AI content
      for (let i = 0; i < slideContents.length; i++) {
        const slideContent = slideContents[i];
        const slideNumber = i + 1;

        // Clone the template slide and modify content
        const newSlideXml = await this.populateSlideWithContent(
          slideStructure,
          slideContent,
          slideNumber
        );

        const builder = new xml2js.Builder();
        const xmlString = builder.buildObject(newSlideXml);

        zip.addFile(`ppt/slides/slide${slideNumber}.xml`, Buffer.from(xmlString, 'utf8'));

        // Create slide relationships
        const slideRels = this.createSlideRelationships(slideNumber);
        zip.addFile(
          `ppt/slides/_rels/slide${slideNumber}.xml.rels`,
          Buffer.from(slideRels, 'utf8')
        );
      }

      // Update presentation.xml with correct slide count
      await this.updatePresentationXml(zip, slideContents.length);

      // Update [Content_Types].xml
      await this.updateContentTypes(zip, slideContents.length);

      // Update presentation relationships
      await this.updatePresentationRels(zip, slideContents.length);

      // Write the final file
      zip.writeZip(outputPath);

      return outputPath;
    } catch (error) {
      console.error('Template cloning error:', error);
      throw error;
    }
  }

  async populateSlideWithContent(slideStructure, content, slideNumber) {
    // Deep clone the structure
    const newSlide = JSON.parse(JSON.stringify(slideStructure));

    try {
      // Find and update text boxes in the slide
      const cSld = newSlide['p:sld']?.['p:cSld']?.[0];
      if (!cSld) return newSlide;

      const spTree = cSld['p:spTree']?.[0];
      if (!spTree) return newSlide;

      const shapes = spTree['p:sp'];
      if (!shapes || !Array.isArray(shapes)) return newSlide;

      let titleUpdated = false;
      let contentUpdated = false;
      let bulletIndex = 0;

      for (let shape of shapes) {
        if (!shape['p:txBody']) continue;

        const txBody = shape['p:txBody'][0];
        if (!txBody['a:p']) continue;

        // Check if this is a title placeholder
        const isTitle = this.isPlaceholderType(shape, 'title') || 
                       this.isPlaceholderType(shape, 'ctrTitle');

        // Check if this is a content/body placeholder
        const isContent = this.isPlaceholderType(shape, 'body') || 
                         this.isPlaceholderType(shape, 'obj');

        if (isTitle && !titleUpdated && content.title) {
          // Update title
          this.updateTextInParagraphs(txBody['a:p'], content.title);
          titleUpdated = true;
        } else if (isContent && !contentUpdated) {
          // Update content with bullet points or main content
          if (content.bulletPoints && content.bulletPoints.length > 0) {
            // Replace with bullet points
            txBody['a:p'] = content.bulletPoints.map((bullet, idx) => {
              return this.createBulletParagraph(bullet, idx);
            });
            contentUpdated = true;
          } else if (content.content) {
            // Replace with main content
            this.updateTextInParagraphs(txBody['a:p'], content.content);
            contentUpdated = true;
          }
        }
      }

      return newSlide;
    } catch (error) {
      console.error('Error populating slide content:', error);
      return slideStructure; // Return original if update fails
    }
  }

  isPlaceholderType(shape, type) {
    try {
      if (!shape['p:nvSpPr'] || !shape['p:nvSpPr'][0] || !shape['p:nvSpPr'][0]['p:nvPr']) return false;
      
      const nvPr = shape['p:nvSpPr'][0]['p:nvPr'][0];
      if (!nvPr['p:ph']) return false;

      const placeholder = nvPr['p:ph'][0];
      if (!placeholder['$']) return false;

      return placeholder['$'].type === type;
    } catch {
      return false;
    }
  }

  updateTextInParagraphs(paragraphs, newText) {
    if (!paragraphs || paragraphs.length === 0) return;

    // Clear existing text runs and add new one
    const firstParagraph = paragraphs[0];
    
    // Preserve formatting from first run if it exists
    let formatting = {};
    if (firstParagraph['a:r'] && firstParagraph['a:r'][0] && firstParagraph['a:r'][0]['a:rPr']) {
      formatting = firstParagraph['a:r'][0]['a:rPr'][0];
    }

    firstParagraph['a:r'] = [{
      'a:rPr': [formatting],
      'a:t': [newText]
    }];

    // Remove extra paragraphs
    paragraphs.splice(1);
  }

  createBulletParagraph(text, index) {
    return {
      'a:pPr': [{
        '$': { lvl: '0' },
        'a:buFont': [{ '$': { typeface: 'Arial' } }],
        'a:buChar': [{ '$': { char: '•' } }]
      }],
      'a:r': [{
        'a:rPr': [{
          '$': { lang: 'en-US', sz: '1800', dirty: '0' }
        }],
        'a:t': [text]
      }]
    };
  }

  createSlideRelationships(slideNumber) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
  }

  async updatePresentationXml(zip, slideCount) {
    try {
      const presentationEntry = zip.getEntry('ppt/presentation.xml');
      if (!presentationEntry) {
        console.warn('presentation.xml not found');
        return;
      }

      const presentationXml = presentationEntry.getData().toString('utf8');
      const parser = new xml2js.Parser();
      const presentation = await parser.parseStringPromise(presentationXml);

      // Update slide ID list
      const sldIdLst = [];
      for (let i = 0; i < slideCount; i++) {
        sldIdLst.push({
          '$': {
            id: `${256 + i}`,
            'r:id': `rId${i + 2}`
          }
        });
      }

      if (!presentation['p:presentation']) {
        presentation['p:presentation'] = {};
      }

      if (!presentation['p:presentation']['p:sldIdLst']) {
        presentation['p:presentation']['p:sldIdLst'] = [];
      }

      presentation['p:presentation']['p:sldIdLst'][0] = { 'p:sldId': sldIdLst };

      const builder = new xml2js.Builder();
      const updatedXml = builder.buildObject(presentation);
      
      zip.updateFile('ppt/presentation.xml', Buffer.from(updatedXml, 'utf8'));
    } catch (error) {
      console.error('Error updating presentation.xml:', error);
    }
  }

  async updateContentTypes(zip, slideCount) {
    try {
      const contentTypesEntry = zip.getEntry('[Content_Types].xml');
      if (!contentTypesEntry) {
        console.warn('[Content_Types].xml not found');
        return;
      }

      let contentTypesXml = contentTypesEntry.getData().toString('utf8');
      
      // Remove old slide references
      contentTypesXml = contentTypesXml.replace(
        /<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*>/g,
        ''
      );

      // Remove old slide relationship references
      contentTypesXml = contentTypesXml.replace(
        /<Override PartName="\/ppt\/slides\/_rels\/slide\d+\.xml\.rels"[^>]*>/g,
        ''
      );

      // Add new slide references
      let slideOverrides = '';
      for (let i = 1; i <= slideCount; i++) {
        slideOverrides += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
        slideOverrides += `<Override PartName="/ppt/slides/_rels/slide${i}.xml.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`;
      }

      contentTypesXml = contentTypesXml.replace('</Types>', `${slideOverrides}</Types>`);
      
      zip.updateFile('[Content_Types].xml', Buffer.from(contentTypesXml, 'utf8'));
    } catch (error) {
      console.error('Error updating [Content_Types].xml:', error);
    }
  }

  async updatePresentationRels(zip, slideCount) {
    try {
      const relsEntry = zip.getEntry('ppt/_rels/presentation.xml.rels');
      if (!relsEntry) {
        console.warn('presentation.xml.rels not found');
        return;
      }

      const relsXml = relsEntry.getData().toString('utf8');
      const parser = new xml2js.Parser();
      const rels = await parser.parseStringPromise(relsXml);

      // Remove old slide relationships
      let relationships = [];
      if (rels['Relationships'] && rels['Relationships']['Relationship']) {
        relationships = Array.isArray(rels['Relationships']['Relationship']) 
          ? rels['Relationships']['Relationship'] 
          : [rels['Relationships']['Relationship']];
      }

      const filteredRels = relationships.filter(rel => {
        const target = rel['$']?.Target || '';
        return !target.includes('/slides/slide');
      });

      // Add new slide relationships
      for (let i = 1; i <= slideCount; i++) {
        filteredRels.push({
          '$': {
            Id: `rId${i + 1}`,
            Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
            Target: `slides/slide${i}.xml`
          }
        });
      }

      rels['Relationships']['Relationship'] = filteredRels;

      const builder = new xml2js.Builder();
      const updatedRels = builder.buildObject(rels);
      
      zip.updateFile('ppt/_rels/presentation.xml.rels', Buffer.from(updatedRels, 'utf8'));
    } catch (error) {
      console.error('Error updating presentation.xml.rels:', error);
    }
  }
}

module.exports = new TemplateClonerService();

