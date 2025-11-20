const mongoose = require('mongoose');

const slideSchema = new mongoose.Schema({
  slideNumber: Number,
  type: {
    type: String,
    enum: ['title', 'agenda', 'content', 'image', 'chart', 'quote', 'comparison', 'timeline', 'conclusion'],
  },
  title: String,
  content: String,
  bulletPoints: [String],
  imageUrl: String,
  layout: String,
  backgroundColor: String,
  textColor: String,
  accentColor: String,
  chartData: mongoose.Schema.Types.Mixed,
  notes: String,
});

const presentationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  mode: {
    type: String,
    enum: ['investor', 'professional', 'educational', 'creative', 'fun', 'minimalist', 'hackathon'],
    default: 'professional',
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
  },
  slides: [slideSchema],
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
  generatedBy: {
    type: String,
    default: 'claude-ai',
  },
  status: {
    type: String,
    enum: ['generating', 'ready', 'error'],
    default: 'generating',
  },
  fileUrl: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Presentation', presentationSchema);

