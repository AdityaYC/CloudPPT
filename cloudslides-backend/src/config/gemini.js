const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

const getGeminiModel = (modelName = 'gemini-1.5-pro') => {
  return genAI.getGenerativeModel({ model: modelName });
};

module.exports = { genAI, getGeminiModel };

