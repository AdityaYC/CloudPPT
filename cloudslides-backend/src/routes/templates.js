const express = require('express');
const Template = require('../models/Template');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all public templates
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find({ isPublic: true }).sort({ usageCount: -1 });
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get template by ID
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

module.exports = router;

