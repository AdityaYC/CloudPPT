const Presentation = require('../models/Presentation');
const User = require('../models/User');
const claudeService = require('../services/claudeService');
const fastTemplateService = require('../services/fastTemplateService');
const templateParserService = require('../services/templateParserService');
const colorSchemes = require('../utils/colorSchemes');

class PresentationController {
  // Generate new presentation
  async generate(req, res) {
    let presentation = null;
    try {
      // Handle both JSON and FormData requests
      const topic = req.body.topic;
      const mode = req.body.mode;
      const audience = req.body.audience;
      const duration = req.body.duration;
      const keyPoints = req.body.keyPoints ? (Array.isArray(req.body.keyPoints) ? req.body.keyPoints : typeof req.body.keyPoints === 'string' ? JSON.parse(req.body.keyPoints) : req.body.keyPoints) : undefined;
      const templateId = req.body.templateId;
      const colorScheme = req.body.colorScheme ? (typeof req.body.colorScheme === 'string' ? JSON.parse(req.body.colorScheme) : req.body.colorScheme) : undefined;
      const templateFile = req.file; // Uploaded template file (from multer)
      
      const userId = req.user.id;

      // Validate input
      if (!topic || !mode) {
        return res.status(400).json({ error: 'Topic and mode are required' });
      }

      // Load template if templateId is provided
      let selectedTemplate = null;
      if (templateId && templateId !== 'none') {
        const Template = require('../models/Template');
        selectedTemplate = await Template.findById(templateId);
        if (selectedTemplate) {
          // Increment usage count
          selectedTemplate.usageCount = (selectedTemplate.usageCount || 0) + 1;
          await selectedTemplate.save();
        }
      }

      // Use template's color scheme and font if available, otherwise use defaults
      const finalColorScheme = selectedTemplate?.colorScheme || colorScheme || colorSchemes[mode] || colorSchemes.professional;
      const finalFont = selectedTemplate?.font || {
        heading: 'Arial',
        body: 'Calibri',
      };

      // Create presentation record
      presentation = new Presentation({
        user: userId,
        title: topic.substring(0, 100),
        description: topic,
        mode,
        status: 'generating',
        template: templateId && templateId !== 'none' ? templateId : undefined,
        colorScheme: finalColorScheme,
        font: finalFont,
      });

      await presentation.save();

      // Generate slides with Claude AI
      const context = { audience, duration, keyPoints };
      
      // Get template path early for parallel processing
      let templatePath = null;
      if (templateFile) {
        templatePath = templateFile.path;
      } else if (selectedTemplate && selectedTemplate.filePath) {
        templatePath = selectedTemplate.filePath;
      }

      // Generate slides and extract colors in parallel for speed
      const [slides, templateColors] = await Promise.all([
        claudeService.generatePresentationStructure(topic, mode, context),
        templatePath 
          ? fastTemplateService.quickExtractColors(templatePath)
          : Promise.resolve(null)
      ]);

      // Update presentation with slides
      presentation.slides = slides;
      if (templateColors) {
        presentation.colorScheme = { ...presentation.colorScheme, ...templateColors };
      }
      presentation.status = 'ready';
      await presentation.save();

      // Generate PPTX file using fast template service
      // If no template provided, use default colors
      if (!templatePath) {
        console.log('No template provided, using default generation');
      } else {
        console.log('Generating PPTX with fast template service using template:', templatePath);
      }

      const fileData = await fastTemplateService.createPresentationFromTemplate(
        {
          title: presentation.title,
          description: presentation.description,
          slides: presentation.slides,
          colorScheme: presentation.colorScheme,
          font: presentation.font,
        },
        templatePath
      );

      presentation.fileUrl = fileData.url;
      await presentation.save();

      // Don't clean up uploaded template file if it's being saved as a template
      // Only clean up if it was a one-time use
      // (Template files saved to database will be kept)

      // Update user presentation count
      await User.findByIdAndUpdate(userId, { $inc: { presentationsCount: 1 } });

      res.status(201).json({
        success: true,
        presentation: {
          id: presentation._id,
          title: presentation.title,
          mode: presentation.mode,
          slides: presentation.slides,
          fileUrl: presentation.fileUrl,
          createdAt: presentation.createdAt,
        },
      });
    } catch (error) {
      console.error('Generate presentation error:', error);
      
      // Update presentation status to error if it exists
      if (presentation && presentation._id) {
        try {
          presentation.status = 'error';
          await presentation.save();
        } catch (saveError) {
          console.error('Failed to update presentation status:', saveError);
        }
      }
      
      // Return more specific error message
      const errorMessage = error.message || 'Failed to generate presentation';
      res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Get all user presentations
  async getUserPresentations(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const presentations = await Presentation.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-slides'); // Exclude slides for list view

      const count = await Presentation.countDocuments({ user: userId });

      res.json({
        presentations,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      });
    } catch (error) {
      console.error('Get presentations error:', error);
      res.status(500).json({ error: 'Failed to fetch presentations' });
    }
  }

  // Get single presentation
  async getPresentation(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const presentation = await Presentation.findOne({ _id: id, user: userId });

      if (!presentation) {
        return res.status(404).json({ error: 'Presentation not found' });
      }

      res.json({ presentation });
    } catch (error) {
      console.error('Get presentation error:', error);
      res.status(500).json({ error: 'Failed to fetch presentation' });
    }
  }

  // Update presentation
  async updatePresentation(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { slides, colorScheme, font, title } = req.body;

      const presentation = await Presentation.findOne({ _id: id, user: userId });

      if (!presentation) {
        return res.status(404).json({ error: 'Presentation not found' });
      }

      // Update fields
      if (slides) presentation.slides = slides;
      if (colorScheme) presentation.colorScheme = colorScheme;
      if (font) presentation.font = font;
      if (title) presentation.title = title;
      presentation.updatedAt = Date.now();

      await presentation.save();

      // Get template path for regeneration
      let templatePath = null;
      if (presentation.template) {
        const Template = require('../models/Template');
        const template = await Template.findById(presentation.template);
        if (template && template.filePath) {
          templatePath = template.filePath;
        }
      }

      if (templatePath) {
        const fileData = await fastTemplateService.createPresentationFromTemplate({
          title: presentation.title,
          description: presentation.description,
          slides: presentation.slides,
          colorScheme: presentation.colorScheme,
          font: presentation.font,
        }, templatePath);

        presentation.fileUrl = fileData.url;
        await presentation.save();
      }

      res.json({ success: true, presentation });
    } catch (error) {
      console.error('Update presentation error:', error);
      res.status(500).json({ error: 'Failed to update presentation' });
    }
  }

  // Delete presentation
  async deletePresentation(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const presentation = await Presentation.findOneAndDelete({ _id: id, user: userId });

      if (!presentation) {
        return res.status(404).json({ error: 'Presentation not found' });
      }

      res.json({ success: true, message: 'Presentation deleted successfully' });
    } catch (error) {
      console.error('Delete presentation error:', error);
      res.status(500).json({ error: 'Failed to delete presentation' });
    }
  }

  // Enhance specific slide
  async enhanceSlide(req, res) {
    try {
      const { id, slideNumber } = req.params;
      const userId = req.user.id;
      const { tone, style } = req.body;

      const presentation = await Presentation.findOne({ _id: id, user: userId });

      if (!presentation) {
        return res.status(404).json({ error: 'Presentation not found' });
      }

      const slide = presentation.slides[slideNumber - 1];
      if (!slide) {
        return res.status(404).json({ error: 'Slide not found' });
      }

      const enhancedContent = await claudeService.enhanceSlideContent(slide, { tone, style });

      // Update slide
      presentation.slides[slideNumber - 1] = { ...slide.toObject(), ...enhancedContent };
      await presentation.save();

      res.json({ success: true, slide: presentation.slides[slideNumber - 1] });
    } catch (error) {
      console.error('Enhance slide error:', error);
      res.status(500).json({ error: 'Failed to enhance slide' });
    }
  }

  async uploadTemplate(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No template file uploaded' });
      }

      const userId = req.user.id;
      const templatePath = req.file.path;

      // Parse template to extract metadata
      const templateData = await templateParserService.parseUploadedTemplate(templatePath);

      // Save template to database
      const Template = require('../models/Template');
      const template = new Template({
        name: req.body.name || req.file.originalname.replace('.pptx', ''),
        description: req.body.description || '',
        category: req.body.category || 'custom',
        colorScheme: templateData.metadata.colorScheme,
        font: templateData.metadata.fonts,
        filePath: templatePath,
        createdBy: userId,
        isPublic: req.body.isPublic === 'true' || req.body.isPublic === true,
      });

      await template.save();

      res.status(201).json({
        success: true,
        template: {
          id: template._id,
          name: template.name,
          colorScheme: template.colorScheme,
          font: template.font,
          description: template.description,
        },
      });
    } catch (error) {
      console.error('Upload template error:', error);
      res.status(500).json({ error: 'Failed to upload template: ' + error.message });
    }
  }

  async getUserTemplates(req, res) {
    try {
      const userId = req.user.id;
      const Template = require('../models/Template');
      
      const templates = await Template.find({ 
        $or: [{ createdBy: userId }, { isPublic: true }] 
      }).select('-filePath').sort({ createdAt: -1 });

      res.json({ templates });
    } catch (error) {
      console.error('Get templates error:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  }
}

module.exports = new PresentationController();

