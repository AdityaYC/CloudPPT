const PptxGenJS = require('pptxgenjs');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs').promises;
const xml2js = require('xml2js');
const colorSchemes = require('../utils/colorSchemes');

class PptxService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../generated');
    this.templatesDir = path.join(__dirname, '../../uploads/templates');
  }

  async createPresentationFromTemplate(presentationData, templatePath) {
    try {
      // If custom template provided, use the new cloner service
      if (templatePath && await this.fileExists(templatePath)) {
        console.log('📄 Using custom template:', templatePath);
        
        const templateClonerService = require('./templateClonerService');
        
        const filename = `presentation_${Date.now()}.pptx`;
        const outputPath = path.join(this.outputDir, filename);
        
        await fs.mkdir(this.outputDir, { recursive: true });
        
        // Use the template cloner to preserve design
        await templateClonerService.generateFromTemplate(
          templatePath,
          presentationData.slides,
          outputPath
        );

        console.log('✅ Template-based presentation generated successfully');

        return {
          filename,
          filepath: outputPath,
          url: `/api/presentations/download/${filename}`,
        };
      }
      
      // Otherwise use PptxGenJS (default behavior)
      return await this.createPresentation(presentationData);
    } catch (error) {
      console.error('Presentation creation error:', error);
      throw error;
    }
  }

  async generateWithCustomTemplate(presentationData, templatePath) {
    try {
      console.log('📄 Using custom template:', templatePath);
      
      // Create output filename
      const filename = `presentation_${Date.now()}.pptx`;
      const outputPath = path.join(this.outputDir, filename);

      // Copy template to output location
      await fs.copyFile(templatePath, outputPath);

      // Open the copied template
      const zip = new AdmZip(outputPath);
      
      // Remove existing content slides (keep master slides and layouts)
      const entries = zip.getEntries();
      const slideEntries = entries.filter(e => 
        e.entryName.match(/^ppt\/slides\/slide\d+\.xml$/)
      );
      
      slideEntries.forEach(entry => {
        zip.deleteFile(entry.entryName);
      });

      // Remove slide relationship files
      const relEntries = entries.filter(e => 
        e.entryName.startsWith('ppt/slides/_rels/')
      );
      relEntries.forEach(entry => {
        zip.deleteFile(entry.entryName);
      });

      // Generate new slides based on AI content
      for (let i = 0; i < presentationData.slides.length; i++) {
        const slideData = presentationData.slides[i];
        const slideXml = await this.generateSlideXML(slideData, i + 1, presentationData);
        zip.addFile(`ppt/slides/slide${i + 1}.xml`, Buffer.from(slideXml, 'utf8'));
        
        // Create relationship file for slide
        const relXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
        zip.addFile(`ppt/slides/_rels/slide${i + 1}.xml.rels`, Buffer.from(relXml, 'utf8'));
      }

      // Update presentation.xml with new slide references
      await this.updatePresentationXML(zip, presentationData.slides.length);

      // Update content types
      await this.updateContentTypes(zip, presentationData.slides.length);

      // Update slide relationships
      await this.updateSlideRelationships(zip, presentationData.slides.length);

      // Save the modified presentation
      await fs.mkdir(this.outputDir, { recursive: true });
      zip.writeZip(outputPath);

      console.log('✅ Custom template presentation generated successfully');

      return {
        filename,
        filepath: outputPath,
        url: `/api/presentations/download/${filename}`,
      };
    } catch (error) {
      console.error('Custom template generation error:', error);
      throw new Error(`Failed to generate presentation from template: ${error.message}`);
    }
  }

  async generateSlideXML(slideData, slideNumber, presentationData) {
    const colorScheme = presentationData.colorScheme || colorSchemes.professional;
    const fonts = presentationData.font || { heading: 'Arial', body: 'Calibri' };

    // Build slide XML based on slide type
    let slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" 
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>`;

    // Add background
    slideXml += `
    <p:bg>
      <p:bgPr>
        <a:solidFill>
          <a:srgbClr val="${colorScheme.background || 'FFFFFF'}"/>
        </a:solidFill>
      </p:bgPr>
    </p:bg>`;

    slideXml += `<p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>`;

    // Add title shape
    if (slideData.title) {
      slideXml += this.createTextBoxXML(
        2,
        457200,  // x: 0.5 inches in EMUs
        457200,  // y: 0.5 inches
        8229600, // w: 9 inches
        914400,  // h: 1 inch
        slideData.title,
        {
          fontSize: slideData.type === 'title' ? 4400 : 3200,
          bold: true,
          color: colorScheme.primary || '667eea',
          fontFace: fonts.heading || 'Arial',
        }
      );
    }

    // Add content based on slide type
    if (slideData.content) {
      slideXml += this.createTextBoxXML(
        3,
        457200,
        slideData.type === 'title' ? 3657600 : 1828800,
        8229600,
        914400,
        slideData.content,
        {
          fontSize: slideData.type === 'title' ? 2400 : 2000,
          color: colorScheme.text || '000000',
          fontFace: fonts.body || 'Calibri',
        }
      );
    }

    // Add bullet points
    if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
      slideXml += this.createBulletListXML(
        4,
        914400,
        2743200,
        7772400,
        2743200,
        slideData.bulletPoints,
        {
          fontSize: 1800,
          color: colorScheme.text || '000000',
          fontFace: fonts.body || 'Calibri',
        }
      );
    }

    slideXml += `
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

    return slideXml;
  }

  createTextBoxXML(id, x, y, w, h, text, style) {
    return `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${id}" name="TextBox ${id}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${x}" y="${y}"/>
            <a:ext cx="${w}" cy="${h}"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" rtlCol="0">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="${style.fontSize}" ${style.bold ? 'b="1"' : ''}>
                <a:solidFill>
                  <a:srgbClr val="${style.color}"/>
                </a:solidFill>
                <a:latin typeface="${style.fontFace}"/>
              </a:rPr>
              <a:t>${this.escapeXML(text)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
  }

  createBulletListXML(id, x, y, w, h, bullets, style) {
    const paragraphs = bullets.map(bullet => `
      <a:p>
        <a:pPr lvl="0" marL="228600" indent="-228600">
          <a:buFont typeface="Arial"/>
          <a:buChar char="•"/>
        </a:pPr>
        <a:r>
          <a:rPr lang="en-US" sz="${style.fontSize}">
            <a:solidFill>
              <a:srgbClr val="${style.color}"/>
            </a:solidFill>
            <a:latin typeface="${style.fontFace}"/>
          </a:rPr>
          <a:t>${this.escapeXML(bullet)}</a:t>
        </a:r>
      </a:p>`).join('');

    return `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${id}" name="TextBox ${id}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${x}" y="${y}"/>
            <a:ext cx="${w}" cy="${h}"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" rtlCol="0">
            <a:spAutoFit/>
          </a:bodyPr>
          <a:lstStyle/>
          ${paragraphs}
        </p:txBody>
      </p:sp>`;
  }

  async updatePresentationXML(zip, slideCount) {
    const presentationEntry = zip.getEntry('ppt/presentation.xml');
    if (!presentationEntry) return;

    const presentationXml = presentationEntry.getData().toString('utf8');
    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder();

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
    presentation['p:presentation']['p:sldIdLst'] = [{ 'p:sldId': sldIdLst }];

    const updatedXml = builder.buildObject(presentation);
    zip.updateFile('ppt/presentation.xml', Buffer.from(updatedXml, 'utf8'));
  }

  async updateContentTypes(zip, slideCount) {
    const contentTypesEntry = zip.getEntry('[Content_Types].xml');
    if (!contentTypesEntry) return;

    let contentTypesXml = contentTypesEntry.getData().toString('utf8');
    
    // Remove old slide references
    contentTypesXml = contentTypesXml.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*>/g, '');

    // Add new slide references
    let slideOverrides = '';
    for (let i = 1; i <= slideCount; i++) {
      slideOverrides += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    }

    // Also add relationship overrides
    for (let i = 1; i <= slideCount; i++) {
      slideOverrides += `<Override PartName="/ppt/slides/_rels/slide${i}.xml.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`;
    }

    contentTypesXml = contentTypesXml.replace('</Types>', `${slideOverrides}</Types>`);
    
    zip.updateFile('[Content_Types].xml', Buffer.from(contentTypesXml, 'utf8'));
  }

  async updateSlideRelationships(zip, slideCount) {
    // Update presentation.xml.rels to include new slides
    const relsEntry = zip.getEntry('ppt/_rels/presentation.xml.rels');
    if (!relsEntry) return;

    let relsXml = relsEntry.getData().toString('utf8');
    
    // Remove old slide relationships
    relsXml = relsXml.replace(/<Relationship[^>]*Target="slides\/slide\d+\.xml"[^>]*>/g, '');

    // Add new slide relationships
    let slideRels = '';
    for (let i = 1; i <= slideCount; i++) {
      slideRels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
    }

    relsXml = relsXml.replace('</Relationships>', `${slideRels}</Relationships>`);
    
    zip.updateFile('ppt/_rels/presentation.xml.rels', Buffer.from(relsXml, 'utf8'));
  }

  escapeXML(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async createPresentation(presentationData) {
    try {
      if (!presentationData.slides || !Array.isArray(presentationData.slides) || presentationData.slides.length === 0) {
        throw new Error('No slides provided for presentation');
      }

      // If template is provided, use the new template method
      if (presentationData.templatePath) {
        return await this.createPresentationFromTemplate(presentationData, presentationData.templatePath);
      }

      // Otherwise, create new presentation
      const pptx = new PptxGenJS();
      
      // Set presentation properties
      pptx.author = 'CloudSlides AI';
      pptx.company = 'CloudSlides';
      pptx.title = presentationData.title || 'Untitled Presentation';
      pptx.subject = presentationData.description || '';

      // Apply theme
      const finalColorScheme = presentationData.colorScheme || colorSchemes.professional;
      const finalFont = presentationData.font || { heading: 'Arial', body: 'Calibri' };
      
      this.applyTheme(pptx, finalColorScheme, finalFont);
      this.defineMasterSlides(pptx, finalColorScheme);

      // Generate slides
      for (const slideData of presentationData.slides) {
        await this.createSlide(pptx, slideData, finalColorScheme, finalFont);
      }

      // Save presentation
      const filename = `presentation_${Date.now()}.pptx`;
      const filepath = path.join(this.outputDir, filename);

      await fs.mkdir(this.outputDir, { recursive: true });
      await pptx.writeFile({ fileName: filepath });

      return {
        filename,
        filepath,
        url: `/api/presentations/download/${filename}`,
      };
    } catch (error) {
      console.error('PPTX generation error:', error);
      throw new Error(`Failed to create PPTX file: ${error.message}`);
    }
  }

  async createFromTemplate(presentationData) {
    const JSZip = require('jszip');
    const fs = require('fs');
    
    try {
      console.log('📄 Using uploaded template file:', presentationData.templatePath);
      
      // Copy the template file as the base
      const filename = `presentation_${Date.now()}.pptx`;
      const filepath = path.join(this.outputDir, filename);
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Copy template to output location
      await fs.promises.copyFile(presentationData.templatePath, filepath);
      
      // Read the copied template
      const templateBuffer = await fs.promises.readFile(filepath);
      const zip = await JSZip.loadAsync(templateBuffer);
      
      // Remove existing slides from template (we'll add new AI-generated ones)
      const slideFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('ppt/slides/slide') && (name.endsWith('.xml') || name.includes('/'))
      );
      
      slideFiles.forEach(slideFile => {
        delete zip.files[slideFile];
      });
      
      // Also remove slide relationships
      const relFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('ppt/slides/_rels/')
      );
      relFiles.forEach(relFile => {
        delete zip.files[relFile];
      });
      
      // Create new slides using pptxgenjs
      const pptx = new PptxGenJS();
      pptx.author = 'CloudSlides AI';
      pptx.company = 'CloudSlides';
      pptx.title = presentationData.title || 'Untitled Presentation';
      pptx.subject = presentationData.description || '';

      const finalColorScheme = presentationData.colorScheme || colorSchemes.professional;
      const finalFont = presentationData.font || { heading: 'Arial', body: 'Calibri' };
      
      // Generate new slides
      for (const slideData of presentationData.slides) {
        await this.createSlide(pptx, slideData, finalColorScheme, finalFont);
      }

      // Save new slides to a temporary file
      const tempFile = filepath.replace('.pptx', '_temp.pptx');
      await pptx.writeFile({ fileName: tempFile });
      
      // Read the new presentation
      const newBuffer = await fs.promises.readFile(tempFile);
      const newZip = await JSZip.loadAsync(newBuffer);
      
      // Copy new slides into the template
      const newSlideFiles = Object.keys(newZip.files).filter(name => 
        name.startsWith('ppt/slides/')
      );
      
      for (const slideFile of newSlideFiles) {
        const slideContent = await newZip.file(slideFile).async('nodebuffer');
        zip.file(slideFile, slideContent);
      }
      
      // Update presentation.xml to include new slides
      try {
        const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
        const newPresentationXml = await newZip.file('ppt/presentation.xml')?.async('string');
        
        if (presentationXml && newPresentationXml) {
          // Extract sldIdLst from new presentation and merge into template
          const sldIdMatch = newPresentationXml.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/);
          if (sldIdMatch) {
            const updatedXml = presentationXml.replace(
              /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
              `<p:sldIdLst>${sldIdMatch[1]}</p:sldIdLst>`
            );
            zip.file('ppt/presentation.xml', updatedXml);
          }
        }
      } catch (err) {
        console.log('Could not update presentation.xml, using new one');
        const newPresXml = await newZip.file('ppt/presentation.xml')?.async('nodebuffer');
        if (newPresXml) {
          zip.file('ppt/presentation.xml', newPresXml);
        }
      }
      
      // Save the final merged presentation
      const mergedBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      await fs.promises.writeFile(filepath, mergedBuffer);
      
      // Clean up temp file
      try {
        await fs.promises.unlink(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      console.log('✅ Template structure used with AI-generated content');
      
      return {
        filename,
        filepath,
        url: `/api/presentations/download/${filename}`,
      };
    } catch (error) {
      console.error('Template processing error:', error);
      // Fallback to creating new presentation
      console.log('Falling back to new presentation creation');
      return await this.createPresentation({ ...presentationData, templatePath: null });
    }
  }

  applyTheme(pptx, colorScheme, font) {
    pptx.layout = 'LAYOUT_16x9';
    
    pptx.defineSlideMaster({
      title: 'MASTER_SLIDE',
      background: { color: colorScheme.background || 'FFFFFF' },
      objects: [
        {
          rect: {
            x: 0,
            y: 0,
            w: '100%',
            h: 0.5,
            fill: { color: colorScheme.primary || '667eea' },
          },
        },
      ],
    });
  }

  defineMasterSlides(pptx, colorScheme) {
    // Title Slide Master
    pptx.defineSlideMaster({
      title: 'TITLE_SLIDE',
      background: { color: colorScheme.background || 'FFFFFF' },
      objects: [
        {
          placeholder: {
            options: { name: 'title', type: 'title', x: 0.5, y: 2, w: 9, h: 1.5, fontSize: 44, bold: true, color: colorScheme.text || '000000' },
            text: '(Title)',
          },
        },
        {
          placeholder: {
            options: { name: 'subtitle', type: 'body', x: 0.5, y: 4, w: 9, h: 0.8, fontSize: 24, color: colorScheme.text || '666666' },
            text: '(Subtitle)',
          },
        },
      ],
    });

    // Content Slide Master
    pptx.defineSlideMaster({
      title: 'CONTENT_SLIDE',
      background: { color: colorScheme.background || 'FFFFFF' },
      objects: [
        {
          placeholder: {
            options: { name: 'title', type: 'title', x: 0.5, y: 0.5, w: 9, h: 0.8, fontSize: 32, bold: true, color: colorScheme.primary || '667eea' },
            text: '(Title)',
          },
        },
        {
          placeholder: {
            options: { name: 'body', type: 'body', x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 18, color: colorScheme.text || '000000' },
            text: '(Content)',
          },
        },
      ],
    });
  }

  async createSlide(pptx, slideData, colorScheme, font) {
    const slide = pptx.addSlide();

    switch (slideData.type) {
      case 'title':
        this.createTitleSlide(slide, slideData, colorScheme, font);
        break;
      case 'agenda':
        this.createAgendaSlide(slide, slideData, colorScheme, font);
        break;
      case 'content':
        this.createContentSlide(slide, slideData, colorScheme, font);
        break;
      case 'image':
        await this.createImageSlide(slide, slideData, colorScheme, font);
        break;
      case 'chart':
        this.createChartSlide(slide, slideData, colorScheme, font);
        break;
      case 'quote':
        this.createQuoteSlide(slide, slideData, colorScheme, font);
        break;
      case 'comparison':
        this.createComparisonSlide(slide, slideData, colorScheme, font);
        break;
      case 'timeline':
        this.createTimelineSlide(slide, slideData, colorScheme, font);
        break;
      case 'conclusion':
        this.createConclusionSlide(slide, slideData, colorScheme, font);
        break;
      default:
        this.createContentSlide(slide, slideData, colorScheme, font);
    }

    // Add notes if present
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  createTitleSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Gradient background accent
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: 2,
      fill: { type: 'solid', color: colorScheme.primary || '667eea', transparency: 10 },
    });

    // Main title
    slide.addText(data.title, {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 1.5,
      fontSize: 48,
      bold: true,
      color: colorScheme.text || '000000',
      fontFace: font.heading || 'Arial',
      align: 'center',
    });

    // Subtitle
    if (data.content) {
      slide.addText(data.content, {
        x: 0.5,
        y: 4.2,
        w: 9,
        h: 0.8,
        fontSize: 24,
        color: colorScheme.text || '666666',
        fontFace: font.body || 'Arial',
        align: 'center',
      });
    }

    // Accent line
    slide.addShape('rect', {
      x: 3.5,
      y: 5.2,
      w: 3,
      h: 0.05,
      fill: { color: colorScheme.accent || 'ec4899' },
    });
  }

  createAgendaSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Title
    slide.addText(data.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 36,
      bold: true,
      color: colorScheme.primary || '667eea',
      fontFace: font.heading || 'Arial',
    });

    // Agenda items
    const items = data.bulletPoints || [];
    items.forEach((item, index) => {
      const yPos = 1.8 + index * 0.7;

      // Number circle
      slide.addShape('ellipse', {
        x: 0.8,
        y: yPos,
        w: 0.5,
        h: 0.5,
        fill: { color: colorScheme.accent || 'ec4899' },
      });

      slide.addText((index + 1).toString(), {
        x: 0.8,
        y: yPos,
        w: 0.5,
        h: 0.5,
        fontSize: 18,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        valign: 'middle',
      });

      // Item text
      slide.addText(item, {
        x: 1.5,
        y: yPos + 0.1,
        w: 7.5,
        h: 0.5,
        fontSize: 20,
        color: colorScheme.text || '000000',
        fontFace: font.body || 'Arial',
      });
    });
  }

  createContentSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Title with underline
    slide.addText(data.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: colorScheme.primary || '667eea',
      fontFace: font.heading || 'Arial',
    });

    slide.addShape('rect', {
      x: 0.5,
      y: 1.35,
      w: 2,
      h: 0.05,
      fill: { color: colorScheme.accent || 'ec4899' },
    });

    // Main content
    if (data.content) {
      slide.addText(data.content, {
        x: 0.5,
        y: 1.8,
        w: 9,
        h: 1,
        fontSize: 20,
        color: colorScheme.text || '333333',
        fontFace: font.body || 'Arial',
      });
    }

    // Bullet points
    if (data.bulletPoints && data.bulletPoints.length > 0) {
      const bulletText = data.bulletPoints.map(point => ({
        text: point,
        options: { bullet: true, fontSize: 18, color: colorScheme.text || '000000' },
      }));

      slide.addText(bulletText, {
        x: 0.8,
        y: data.content ? 3 : 2,
        w: 8.5,
        h: 3,
        fontFace: font.body || 'Arial',
      });
    }
  }

  async createImageSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Title
    slide.addText(data.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: colorScheme.primary || '667eea',
      fontFace: font.heading || 'Arial',
    });

    // Image placeholder (if image URL provided, you can add actual image)
    slide.addShape('rect', {
      x: 1.5,
      y: 1.8,
      w: 7,
      h: 4,
      fill: { color: 'F0F0F0' },
      line: { color: colorScheme.primary || '667eea', width: 2 },
    });

    slide.addText('[Image]', {
      x: 1.5,
      y: 3.5,
      w: 7,
      h: 0.8,
      fontSize: 24,
      color: '999999',
      align: 'center',
      valign: 'middle',
    });

    // Caption
    if (data.content) {
      slide.addText(data.content, {
        x: 0.5,
        y: 6,
        w: 9,
        h: 0.5,
        fontSize: 16,
        italic: true,
        color: colorScheme.text || '666666',
        fontFace: font.body || 'Arial',
        align: 'center',
      });
    }
  }

  createChartSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Title
    slide.addText(data.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: colorScheme.primary || '667eea',
      fontFace: font.heading || 'Arial',
    });

    // Sample chart data (you can customize based on chartData)
    const chartData = data.chartData || {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      values: [65, 75, 85, 95],
    };

    slide.addChart('bar', 
      [
        {
          name: 'Growth',
          labels: chartData.labels,
          values: chartData.values,
        },
      ],
      {
        x: 1,
        y: 1.8,
        w: 8,
        h: 4,
        showTitle: false,
        chartColors: [colorScheme.primary || '667eea'],
      }
    );
  }

  createQuoteSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Large opening quote mark
    slide.addText('"', {
      x: 1,
      y: 1.5,
      w: 1,
      h: 1,
      fontSize: 120,
      color: colorScheme.accent || 'ec4899',
      fontFace: 'Georgia',
    });

    // Quote text
    slide.addText(data.content || data.title, {
      x: 1.5,
      y: 2.5,
      w: 7,
      h: 2,
      fontSize: 28,
      italic: true,
      color: colorScheme.text || '000000',
      fontFace: font.body || 'Arial',
      align: 'center',
      valign: 'middle',
    });

    // Attribution
    if (data.bulletPoints && data.bulletPoints.length > 0) {
      slide.addText(`— ${data.bulletPoints[0]}`, {
        x: 2,
        y: 5,
        w: 6,
        h: 0.5,
        fontSize: 18,
        color: colorScheme.text || '666666',
        fontFace: font.body || 'Arial',
        align: 'center',
      });
    }
  }

  createComparisonSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Title
    slide.addText(data.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: colorScheme.primary || '667eea',
      fontFace: font.heading || 'Arial',
    });

    // Left column
    slide.addShape('rect', {
      x: 0.5,
      y: 1.5,
      w: 4.25,
      h: 4.5,
      fill: { color: 'F8F9FA' },
      line: { color: colorScheme.primary || '667eea', width: 2 },
    });

    const leftPoints = data.bulletPoints ? data.bulletPoints.slice(0, Math.ceil(data.bulletPoints.length / 2)) : [];
    slide.addText(
      leftPoints.map(point => ({ text: point, options: { bullet: true } })),
      {
        x: 0.7,
        y: 2,
        w: 3.85,
        h: 3.5,
        fontSize: 16,
        color: colorScheme.text || '000000',
        fontFace: font.body || 'Arial',
      }
    );

    // Right column
    slide.addShape('rect', {
      x: 5.25,
      y: 1.5,
      w: 4.25,
      h: 4.5,
      fill: { color: 'F8F9FA' },
      line: { color: colorScheme.accent || 'ec4899', width: 2 },
    });

    const rightPoints = data.bulletPoints ? data.bulletPoints.slice(Math.ceil(data.bulletPoints.length / 2)) : [];
    slide.addText(
      rightPoints.map(point => ({ text: point, options: { bullet: true } })),
      {
        x: 5.45,
        y: 2,
        w: 3.85,
        h: 3.5,
        fontSize: 16,
        color: colorScheme.text || '000000',
        fontFace: font.body || 'Arial',
      }
    );
  }

  createTimelineSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Title
    slide.addText(data.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: colorScheme.primary || '667eea',
      fontFace: font.heading || 'Arial',
    });

    // Timeline line
    slide.addShape('rect', {
      x: 1,
      y: 3.5,
      w: 8,
      h: 0.1,
      fill: { color: colorScheme.primary || '667eea' },
    });

    // Timeline points
    const points = data.bulletPoints || [];
    const spacing = 8 / (points.length - 1 || 1);

    points.forEach((point, index) => {
      const xPos = 1 + index * spacing;

      // Circle
      slide.addShape('ellipse', {
        x: xPos - 0.15,
        y: 3.35,
        w: 0.3,
        h: 0.3,
        fill: { color: colorScheme.accent || 'ec4899' },
      });

      // Text
      slide.addText(point, {
        x: xPos - 0.75,
        y: index % 2 === 0 ? 2.5 : 4,
        w: 1.5,
        h: 0.8,
        fontSize: 14,
        color: colorScheme.text || '000000',
        fontFace: font.body || 'Arial',
        align: 'center',
      });
    });
  }

  createConclusionSlide(slide, data, colorScheme, font) {
    slide.background = { color: colorScheme.background || 'FFFFFF' };

    // Gradient background
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
      fill: { type: 'solid', color: colorScheme.primary || '667eea', transparency: 5 },
    });

    // Main title
    slide.addText(data.title, {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: colorScheme.text || '000000',
      fontFace: font.heading || 'Arial',
      align: 'center',
    });

    // Key takeaways
    if (data.bulletPoints && data.bulletPoints.length > 0) {
      slide.addText(
        data.bulletPoints.map(point => ({ text: point, options: { bullet: true } })),
        {
          x: 2,
          y: 4.2,
          w: 6,
          h: 2,
          fontSize: 18,
          color: colorScheme.text || '000000',
          fontFace: font.body || 'Arial',
          align: 'center',
        }
      );
    }
  }
}

module.exports = new PptxService();

