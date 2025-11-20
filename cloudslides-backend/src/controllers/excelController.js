const excelService = require('../services/excelService');
const Excel = require('../models/Excel');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for PDF and CSV uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/data-files');
    const fs = require('fs').promises;
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `file-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimeTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'text/plain'
    ];

    if (allowedTypes.includes(ext) || allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and CSV files are allowed'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

class ExcelController {
  constructor() {
    this.uploadMiddleware = upload.single('file');
  }

  // Generate from text prompt
  async generate(req, res) {
    let excel = null;
    try {
      const { prompt, rows, includeCharts, includeFormulas } = req.body;
      const userId = req.user.id;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      console.log('📊 Excel generation request:', prompt);

      // Create Excel record
      excel = new Excel({
        user: userId,
        prompt,
        status: 'generating',
      });

      await excel.save();

      // Generate Excel with Gemini
      const options = { rows, includeCharts, includeFormulas };
      const fileData = await excelService.generateExcelFromPrompt(prompt, options);

      excel.fileUrl = fileData.url;
      excel.filename = fileData.filename;
      excel.metadata = fileData.metadata;
      excel.status = 'ready';
      await excel.save();

      await User.findByIdAndUpdate(userId, { $inc: { excelsCount: 1 } });

      res.status(201).json({
        success: true,
        excel: {
          id: excel._id,
          prompt: excel.prompt,
          fileUrl: excel.fileUrl,
          metadata: excel.metadata,
          createdAt: excel.createdAt,
        },
      });
    } catch (error) {
      console.error('Excel generation error:', error);
      if (excel && excel._id) {
        try {
          excel.status = 'error';
          await excel.save();
        } catch (saveError) {
          console.error('Failed to update Excel status:', saveError);
        }
      }
      res.status(500).json({
        error: 'Failed to generate Excel file',
        details: error.message,
      });
    }
  }

  // Updated: Generate from file upload (PDF or CSV)
  async generateFromFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.user.id;
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      const { extractTables, includeMetadata, organizeData } = req.body;

      console.log('📄 Excel generation from file:', req.file.originalname);
      console.log('📎 File type:', fileExt);

      // Create Excel record
      const excel = new Excel({
        user: userId,
        prompt: `Extracted from ${fileExt.toUpperCase()}: ${req.file.originalname}`,
        status: 'generating',
      });

      await excel.save();

      let fileData;
      const options = {
        extractTables: extractTables === 'true',
        includeMetadata: includeMetadata === 'true',
        organizeData: organizeData === 'true'
      };

      // Route to appropriate handler based on file type
      if (fileExt === '.pdf') {
        fileData = await excelService.generateExcelFromPDF(req.file.path, options);
      } else if (fileExt === '.csv') {
        fileData = await excelService.generateExcelFromCSV(req.file.path, options);
      } else {
        throw new Error('Unsupported file type');
      }

      excel.fileUrl = fileData.url;
      excel.filename = fileData.filename;
      excel.metadata = fileData.metadata;
      excel.status = 'ready';
      await excel.save();

      await User.findByIdAndUpdate(userId, { $inc: { excelsCount: 1 } });

      res.status(201).json({
        success: true,
        excel: {
          id: excel._id,
          prompt: excel.prompt,
          fileUrl: excel.fileUrl,
          metadata: fileData.metadata,
          createdAt: excel.createdAt,
        },
      });
    } catch (error) {
      console.error('File to Excel error:', error);
      res.status(500).json({
        error: 'Failed to generate Excel from file',
        details: error.message,
      });
    }
  }

  async getUserExcels(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const excels = await Excel.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const count = await Excel.countDocuments({ user: userId });

      res.json({
        excels,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      });
    } catch (error) {
      console.error('Get excels error:', error);
      res.status(500).json({ error: 'Failed to fetch Excel files' });
    }
  }

  async deleteExcel(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const excel = await Excel.findOneAndDelete({ _id: id, user: userId });

      if (!excel) {
        return res.status(404).json({ error: 'Excel file not found' });
      }

      res.json({ success: true, message: 'Excel file deleted successfully' });
    } catch (error) {
      console.error('Delete Excel error:', error);
      res.status(500).json({ error: 'Failed to delete Excel file' });
    }
  }
}

module.exports = new ExcelController();
