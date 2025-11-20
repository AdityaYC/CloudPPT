const speakerNotesService = require('../services/speakerNotesService');
const SpeakerNotes = require('../models/SpeakerNotes');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/documents');
    const fs = require('fs').promises;
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      console.log('✅ Upload directory ready:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Failed to create upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `doc-${uniqueSuffix}${path.extname(file.originalname)}`;
    console.log('📝 Generated filename:', filename);
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.pptx', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    console.log('🔍 File upload attempt:', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      extension: ext
    });
    
    if (allowedTypes.includes(ext)) {
      console.log('✅ File type accepted:', ext);
      cb(null, true);
    } else {
      console.log('❌ File type rejected:', ext);
      cb(new Error(`Only ${allowedTypes.join(', ')} files are allowed. Got: ${ext}`));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

class SpeakerNotesController {
  constructor() {
    this.uploadMiddleware = upload.single('document');
  }

  async generate(req, res) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎤 SPEAKER NOTES GENERATION REQUEST RECEIVED');
    console.log('═══════════════════════════════════════════════════════════');
    
    try {
      console.log('📋 Request body:', req.body);
      console.log('📁 Uploaded file:', req.file ? {
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : 'NO FILE');

      if (!req.file) {
        console.log('❌ ERROR: No document uploaded');
        return res.status(400).json({ 
          error: 'No document uploaded',
          details: 'Please upload a PDF, PPTX, DOCX, or TXT file'
        });
      }

      const userId = req.user.id;
      const { style = 'professional', detail = 'medium', audience = 'general' } = req.body;

      console.log('👤 User ID:', userId);
      console.log('⚙️  Options:', { style, detail, audience });
      console.log('📄 Processing file:', req.file.originalname);

      // Create speaker notes record
      console.log('💾 Creating database record...');
      const speakerNotes = new SpeakerNotes({
        user: userId,
        originalFilename: req.file.originalname,
        status: 'generating',
      });

      await speakerNotes.save();
      console.log('✅ Database record created:', speakerNotes._id);

      // Generate notes with Claude
      console.log('🤖 Starting AI generation...');
      const options = { style, detail, audience };
      const fileData = await speakerNotesService.generateSpeakerNotes(
        req.file.path,
        options
      );

      console.log('✅ AI generation complete:', fileData.filename);

      speakerNotes.fileUrl = fileData.url;
      speakerNotes.filename = fileData.filename;
      speakerNotes.notes = fileData.notes;
      speakerNotes.status = 'ready';
      await speakerNotes.save();

      console.log('✅ Database record updated');

      await User.findByIdAndUpdate(userId, { $inc: { speakerNotesCount: 1 } });
      console.log('✅ User stats updated');

      console.log('🎉 SUCCESS - Returning response');
      console.log('═══════════════════════════════════════════════════════════\n');

      res.status(201).json({
        success: true,
        speakerNotes: {
          id: speakerNotes._id,
          originalFilename: speakerNotes.originalFilename,
          fileUrl: speakerNotes.fileUrl,
          notes: speakerNotes.notes,
          createdAt: speakerNotes.createdAt,
        },
      });
    } catch (error) {
      console.error('❌❌❌ SPEAKER NOTES GENERATION ERROR ❌❌❌');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.log('═══════════════════════════════════════════════════════════\n');
      
      res.status(500).json({
        error: 'Failed to generate speaker notes',
        details: error.message,
        step: 'Check server logs for detailed error information'
      });
    }
  }

  async getUserNotes(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const notes = await SpeakerNotes.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-notes');

      const count = await SpeakerNotes.countDocuments({ user: userId });

      res.json({
        notes,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      });
    } catch (error) {
      console.error('Get notes error:', error);
      res.status(500).json({ error: 'Failed to fetch speaker notes' });
    }
  }

  async getSpeakerNotes(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notes = await SpeakerNotes.findOne({ _id: id, user: userId });

      if (!notes) {
        return res.status(404).json({ error: 'Speaker notes not found' });
      }

      res.json({ speakerNotes: notes });
    } catch (error) {
      console.error('Get speaker notes error:', error);
      res.status(500).json({ error: 'Failed to fetch speaker notes' });
    }
  }

  async deleteNotes(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notes = await SpeakerNotes.findOneAndDelete({ _id: id, user: userId });

      if (!notes) {
        return res.status(404).json({ error: 'Speaker notes not found' });
      }

      res.json({ success: true, message: 'Speaker notes deleted successfully' });
    } catch (error) {
      console.error('Delete notes error:', error);
      res.status(500).json({ error: 'Failed to delete speaker notes' });
    }
  }
}

module.exports = new SpeakerNotesController();
