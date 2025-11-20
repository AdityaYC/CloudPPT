const express = require('express');
const speakerNotesController = require('../controllers/speakerNotesController');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadDocuments');
const path = require('path');

const router = express.Router();

router.use(auth); // All routes require authentication

router.post('/generate', upload.single('document'), speakerNotesController.generate);
router.get('/', speakerNotesController.getUserNotes);
router.get('/:id', speakerNotesController.getSpeakerNotes);
router.delete('/:id', speakerNotesController.deleteNotes);

// Download route
router.get('/download/:filename', (req, res) => {
  const filepath = path.join(__dirname, '../../generated/notes', req.params.filename);
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

