const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  category: {
    type: String,
    enum: ['business', 'education', 'creative', 'minimalist', 'corporate', 'startup', 'custom'],
  },
  filePath: String, // Path to uploaded .pptx file
  thumbnail: String,
  colorScheme: {
    primary: String,
    secondary: String,
    accent: String,
    background: String,
    text: String,
  },
  font: {
    heading: String,
    body: String,
  },
  layouts: {
    titleSlide: String,
    contentSlide: String,
    imageSlide: String,
    chartSlide: String,
  },
  isPublic: {
    type: Boolean,
    default: true,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Template', templateSchema);

