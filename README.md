# desgrava.ar

Tax deduction automation platform for Argentine taxpayers. Upload invoices, calculate tax savings, and automatically submit deductions to ARCA/SiRADIG.

## Features

- **Invoice management** — Upload PDFs (OCR-extracted) or enter manually. AI-powered category classification.
- **Tax simulator** — Calculate your potential Ganancias refund before submitting anything. No registration required.
- **SiRADIG automation** — Connect your ARCA credentials and submit deductions with one click via browser automation.
- **Security** — ARCA credentials encrypted with AES-256-GCM. Never stored in plain text.

## Tech Stack

- **Framework**: Next.js 16 (App Router), TypeScript (strict)
- **Database**: PostgreSQL via Prisma 7
- **Auth**: NextAuth 4 (Google OAuth + Prisma adapter)
- **UI**: shadcn/ui + Tailwind CSS 4 + Radix UI
- **Automation**: Playwright (ARCA/SiRADIG browser automation)
- **OCR**: pdf-parse + Tesseract.js fallback
- **AI**: OpenAI (invoice category classification)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM credential encryption |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `OPENAI_API_KEY` | OpenAI API key for invoice classification |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma migrate dev --name <name>` | Create database migration |
| `npx prisma generate` | Regenerate Prisma client |
