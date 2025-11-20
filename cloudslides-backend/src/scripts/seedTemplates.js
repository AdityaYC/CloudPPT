const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Template = require('../models/Template');
const colorSchemes = require('../utils/colorSchemes');

dotenv.config();

const defaultTemplates = [
  {
    name: 'Modern Business',
    description: 'Clean and professional business template',
    category: 'business',
    colorScheme: colorSchemes.professional,
    font: {
      heading: 'Arial',
      body: 'Calibri',
    },
    isPublic: true,
  },
  {
    name: 'Creative Bold',
    description: 'Vibrant and eye-catching design',
    category: 'creative',
    colorScheme: colorSchemes.creative,
    font: {
      heading: 'Arial',
      body: 'Calibri',
    },
    isPublic: true,
  },
  {
    name: 'Minimalist',
    description: 'Simple and elegant design',
    category: 'minimalist',
    colorScheme: colorSchemes.minimalist,
    font: {
      heading: 'Arial',
      body: 'Calibri',
    },
    isPublic: true,
  },
  {
    name: 'Corporate',
    description: 'Professional corporate template',
    category: 'corporate',
    colorScheme: colorSchemes.corporate,
    font: {
      heading: 'Arial',
      body: 'Calibri',
    },
    isPublic: true,
  },
  {
    name: 'Startup Pitch',
    description: 'Dynamic startup presentation template',
    category: 'startup',
    colorScheme: colorSchemes.startup,
    font: {
      heading: 'Arial',
      body: 'Calibri',
    },
    isPublic: true,
  },
  {
    name: 'Educational',
    description: 'Clear and engaging educational template',
    category: 'education',
    colorScheme: colorSchemes.educational,
    font: {
      heading: 'Arial',
      body: 'Calibri',
    },
    isPublic: true,
  },
];

async function seedTemplates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing templates (optional - comment out if you want to keep existing)
    // await Template.deleteMany({});

    // Insert default templates
    for (const template of defaultTemplates) {
      const existing = await Template.findOne({ name: template.name });
      if (!existing) {
        await Template.create(template);
        console.log(`✅ Created template: ${template.name}`);
      } else {
        console.log(`⏭️  Template already exists: ${template.name}`);
      }
    }

    console.log('✅ Templates seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  }
}

seedTemplates();

