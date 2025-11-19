# URL Fetch & Semantic Search

A simple tool that crawls URLs from CSV files, extracts content, and enables semantic search using AI embeddings.

## Features

- **Upload CSV**: Upload CSV files with URLs (columns: ID, Type, URL)
- **Background Processing**: Automatically fetches URLs, extracts content, and generates embeddings
- **Semantic Search**: Search through all content using AI-powered semantic search

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Queue**: Bull + Redis
- **Vector Store**: Pinecone
- **Embeddings**: OpenRouter API / OpenAI API

## Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- Pinecone account
- OpenRouter API key or OpenAI API key

## Setup

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE url_fetch;
```

### 3. Redis

Make sure Redis is running:

```bash
redis-server
```

### 4. Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your credentials:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=url_fetch
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=url-embeddings

# Embeddings (use either OpenRouter or OpenAI)
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_HTTP_REFERER=http://localhost:3000
EMBEDDING_MODEL=text-embedding-ada-002

# Or use OpenAI directly
OPENAI_API_KEY=your_openai_api_key

# Server
PORT=5000
```

### 5. Run the Application

**Terminal 1 - Backend API:**
```bash
npm run dev:backend
```

**Terminal 2 - Background Worker:**
```bash
cd backend
npm run worker
```

**Terminal 3 - Frontend:**
```bash
npm run dev:frontend
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Usage

### 1. Upload CSV

1. Navigate to the Upload page
2. Select a CSV file with format:
   ```csv
   ID,Type,URL
   1,Article,https://example.com/article
   2,Blog,https://example.com/blog
   ```
3. Click "Upload"
4. URLs will be processed in the background

### 2. Search

1. Navigate to the Search page
2. Enter a search query (e.g., "facebook")
3. Optionally filter by type
4. Click "Search" or press Enter
5. View semantic search results

## API Endpoints

### POST /api/upload

Upload a CSV file for processing.

**Request:**
```json
{
  "csvContent": "base64_encoded_csv",
  "fileName": "test.csv"
}
```

**Response:**
```json
{
  "message": "ok",
  "urlCount": 500,
  "fileName": "test.csv"
}
```

### POST /api/search

Search for URLs using semantic search.

**Request:**
```json
{
  "query": "facebook",
  "types": ["Article"],
  "topK": 20
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "1",
      "url": "https://example.com",
      "type": "Article",
      "title": "Example Title",
      "score": 0.95
    }
  ]
}
```

## Project Structure

```
url-fetch-llm/
├── backend/
│   ├── src/
│   │   ├── config/       # Database, Pinecone, Queue config
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── index.ts      # Express server
│   │   └── worker.ts     # Bull worker
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/        # React pages
│   │   ├── App.tsx       # Main app component
│   │   └── main.tsx      # Entry point
│   └── package.json
└── README.md
```

## Notes

- URLs are processed asynchronously in the background
- Failed URLs are skipped (logged but don't stop processing)
- Search results are boosted when query matches the title
- The system uses 1536-dimensional embeddings (OpenAI ada-002)

