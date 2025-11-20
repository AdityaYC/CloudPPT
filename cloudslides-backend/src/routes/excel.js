const express = require('express');
const excelController = require('../controllers/excelController');
const auth = require('../middleware/auth');
const path = require('path');

const router = express.Router();

router.use(auth);

// Generate from text prompt
router.post('/generate', excelController.generate.bind(excelController));

// Generate from file upload (PDF or CSV)
router.post(
  '/generate-from-file',
  excelController.uploadMiddleware,
  excelController.generateFromFile.bind(excelController)
);

router.get('/', excelController.getUserExcels.bind(excelController));
router.delete('/:id', excelController.deleteExcel.bind(excelController));

router.get('/download/:filename', (req, res) => {
  const filepath = path.join(__dirname, '../../generated/excel', req.params.filename);
  res.download(filepath, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    }
  });
});

module.exports = router;
