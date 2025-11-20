const mongoose = require('mongoose');

const excelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  prompt: {
    type: String,
    required: true,
  },
  filename: String,
  fileUrl: String,
  metadata: {
    title: String,
    description: String,
  },
  status: {
    type: String,
    enum: ['generating', 'ready', 'error'],
    default: 'generating',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Excel', excelSchema);

