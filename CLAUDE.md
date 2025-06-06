# CLAUDE.md
必ず日本語で回答してください。
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server with TypeScript compilation watching
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Start Sanity Studio (CMS)
npm run studio

# Expose local development with ngrok (for LINE LIFF testing)
npm run ngrok
```

## Architecture Overview

This is a Next.js application that provides AI-powered marketing copy generation with multi-service integration.

### Core Services Integration

- **Authentication**: LINE LIFF (LINE Frontend Framework) with automatic token refresh
- **Database**: Supabase with Row Level Security policies
- **Payments**: Stripe subscription management with feature gating
- **AI**: OpenAI API with fine-tuned models for keyword categorization
- **Search**: Google Custom Search + SEMrush for competitive research
- **CMS**: Sanity headless CMS for landing page management
- **WordPress Export**: Convert Sanity content to WordPress posts

### Authentication Flow

1. Users authenticate through LINE LIFF (`src/components/ClientLiffProvider.tsx`)
2. Access tokens are verified server-side (`src/server/services/lineAuthService.ts`)
3. Automatic token refresh handles expiration
4. All protected routes use `checkAuth()` middleware pattern
5. Subscription status gates feature access

### Chat System Architecture

The chat system uses multiple AI models in sequence:

1. **Fine-tuned Model**: `ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2` classifies keywords
2. **Google Search**: Validates and researches keywords
3. **SEMrush API**: Fetches competitor advertising data
4. **Standard GPT**: Generates marketing copy based on research

All chat sessions are persisted in Supabase with user isolation.

### Environment Configuration

Environment variables are type-safe using `@t3-oss/env-nextjs` in `src/env.ts`. Key integrations require:

- LINE: Channel ID and secret for LIFF
- Supabase: URL and service role key
- Stripe: Product/price IDs and API keys
- OpenAI: API key for chat completions
- Google: Search API key and Custom Search Engine ID
- SEMrush: API key for competitive research
- Sanity: Project ID, dataset, and API tokens

### Key Code Patterns

**Service Layer**: All external API calls go through service classes in `src/server/services/`

**Error Handling**: Custom error types like `LineTokenExpiredError` with automatic recovery

**Type Safety**: Strict TypeScript with Zod validation for API responses

**Client/Server Separation**: Client components handle LIFF auth, server actions handle business logic

### Sanity CMS Integration

- Landing pages are managed in Sanity Studio (`/studio`)
- Custom plugins provide WordPress export and debug tools
- Content can be exported to WordPress using Application Passwords
- Preview functionality supports draft content

### WordPress Export Feature

The WordPress export (`src/lib/wordpress-converter.ts`) converts Sanity landing pages into WordPress-compatible HTML posts with:

- Structured HTML generation with inline CSS
- Featured image upload support
- OAuth authentication flow for WordPress API
- Draft/publish status control

### Database Schema

Supabase migrations in `supabase/migrations/` define:

- User profiles linked to LINE accounts
- Chat sessions and message history
- Sanity project configurations
- WordPress connection settings

### Development Notes

- Use TypeScript strict mode (all strict options enabled)
- LIFF components must disable SSR (`ssr: false`)
- API routes follow Next.js 13+ App Router patterns
- Subscription checks are required for all premium features
- Token refresh happens automatically in auth service