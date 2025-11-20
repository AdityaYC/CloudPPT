const express = require('express');
const presentationController = require('../controllers/presentationController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.post('/generate', upload.single('template'), presentationController.generate);
router.post('/upload-template', upload.single('template'), presentationController.uploadTemplate);
router.get('/templates', presentationController.getUserTemplates);
router.get('/', presentationController.getUserPresentations);

// Download route - must be before /:id to avoid route conflicts
router.get('/download/:filename', (req, res) => {
  const filepath = path.join(__dirname, '../../generated', req.params.filename);
  res.download(filepath, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    }
  });
});

router.get('/:id', presentationController.getPresentation);
router.put('/:id', presentationController.updatePresentation);
router.delete('/:id', presentationController.deletePresentation);
router.post('/:id/enhance-slide/:slideNumber', presentationController.enhanceSlide);

module.exports = router;

