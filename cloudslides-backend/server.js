const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./src/config/database');
const errorHandler = require('./src/middleware/errorHandler');

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/presentations', require('./src/routes/presentations'));
app.use('/api/templates', require('./src/routes/templates'));
app.use('/api/excel', require('./src/routes/excel'));
app.use('/api/speaker-notes', require('./src/routes/speakerNotes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'CloudSlides API is running' });
});

// Add this BEFORE the error handler
app.get('/test-claude', async (req, res) => {
  try {
    const anthropic = require('./src/config/claude');

    console.log('Testing Claude API...');
    console.log('API Key present:', !!process.env.ANTHROPIC_API_KEY);
    console.log('API Key (first 10 chars):', process.env.ANTHROPIC_API_KEY?.substring(0, 10));

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say "Hello, API is working!"' }],
    });

    res.json({
      success: true,
      response: message.content[0].text,
      model: message.model,
    });
  } catch (error) {
    console.error('Claude API test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      name: error.name,
    });
  }
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

