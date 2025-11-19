# Quick Start Guide

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed and running
- [ ] Redis installed and running
- [ ] Pinecone account created
- [ ] OpenRouter API key OR OpenAI API key

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Set Up PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE url_fetch;

# Exit psql
\q
```

### 3. Configure Environment Variables

Copy and edit the environment file:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```env
DB_PASSWORD=your_postgres_password
PINECONE_API_KEY=your_pinecone_key
OPENROUTER_API_KEY=your_openrouter_key
# OR
OPENAI_API_KEY=your_openai_key
```

### 4. Start Redis

```bash
redis-server
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

### 6. Test the Application

1. Open http://localhost:3000
2. Go to Upload page
3. Upload `sample.csv` (included in project root)
4. Wait for processing (check worker terminal for progress)
5. Go to Search page
6. Try searching for "technology" or "news"

## Troubleshooting

### Database Connection Error
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `backend/.env`

### Redis Connection Error
- Check Redis is running: `redis-cli ping`
- Should return `PONG`

### Pinecone Error
- Verify API key is correct
- Check index name matches in `.env`
- Index will be created automatically on first run

### Worker Not Processing Jobs
- Make sure worker is running in separate terminal
- Check Redis connection
- Check worker terminal for error messages

### Embedding API Error
- Verify OpenRouter or OpenAI API key is set
- Check API key has sufficient credits/quota

