# CloudSlides Backend API

Complete backend API for the CloudSlides AI Presentation Generator.

## Features

- ✅ Claude AI integration for intelligent slide generation
- ✅ Professional PPTX file creation
- ✅ Multiple presentation modes (investor, professional, educational, creative, etc.)
- ✅ 9 different slide types (title, content, image, chart, quote, comparison, timeline, etc.)
- ✅ Customizable color schemes and fonts
- ✅ User authentication and authorization
- ✅ Presentation CRUD operations
- ✅ Slide enhancement feature
- ✅ Template system
- ✅ File download functionality
- ✅ MongoDB for data persistence

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```
   
   Then update the `.env` file with your actual values:
   - `ANTHROPIC_API_KEY`: Your Claude AI API key
   - `JWT_SECRET`: A secure random string for JWT tokens
   - `MONGODB_URI`: Your MongoDB connection string

3. **Start MongoDB:**
   Make sure MongoDB is running on your system.

4. **Run the server:**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (requires auth)

### Presentations
- `POST /api/presentations/generate` - Generate a new presentation (requires auth)
- `GET /api/presentations` - Get all user presentations (requires auth)
- `GET /api/presentations/:id` - Get a specific presentation (requires auth)
- `PUT /api/presentations/:id` - Update a presentation (requires auth)
- `DELETE /api/presentations/:id` - Delete a presentation (requires auth)
- `POST /api/presentations/:id/enhance-slide/:slideNumber` - Enhance a slide (requires auth)
- `GET /api/presentations/download/:filename` - Download PPTX file (requires auth)

### Templates
- `GET /api/templates` - Get all public templates
- `GET /api/templates/:id` - Get a specific template

### Health Check
- `GET /health` - Server health check

## Example Request

### Generate Presentation

```javascript
const response = await fetch('http://localhost:5000/api/presentations/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    topic: 'Create a pitch deck for a SaaS startup',
    mode: 'investor',
    audience: 'Venture capitalists',
    keyPoints: ['Market size', 'Problem statement', 'Solution', 'Business model'],
  }),
});

const data = await response.json();
```

## Environment Variables

- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `ANTHROPIC_API_KEY` - Claude AI API key
- `JWT_SECRET` - Secret key for JWT tokens
- `NODE_ENV` - Environment (development/production)
- `MAX_FILE_SIZE` - Maximum file size in bytes
- `RATE_LIMIT_WINDOW` - Rate limit window in minutes
- `RATE_LIMIT_MAX` - Maximum requests per window

## Project Structure

```
cloudslides-backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── claude.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── presentationController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Presentation.js
│   │   └── Template.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── presentations.js
│   │   └── templates.js
│   ├── services/
│   │   ├── claudeService.js
│   │   └── pptxService.js
│   └── utils/
│       └── colorSchemes.js
├── generated/          # Generated PPTX files
├── server.js
└── package.json
```

## License

ISC

