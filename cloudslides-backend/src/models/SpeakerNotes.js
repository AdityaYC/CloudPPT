const mongoose = require('mongoose');

const speakerNotesSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  originalFilename: {
    type: String,
    required: true,
  },
  filename: String,
  fileUrl: String,
  notes: mongoose.Schema.Types.Mixed,
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

module.exports = mongoose.model('SpeakerNotes', speakerNotesSchema);

