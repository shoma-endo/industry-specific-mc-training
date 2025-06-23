# CLAUDE.md
必ず日本語で回答してください。
タスクを終えたら npx ccusage@latest を叩いて、コストを表示してください。
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- Follow the user’s requirements carefully & to the letter.
- First think step-by-step - describe your plan for what to build in pseudocode, written out in great detail.
- Confirm, then write code!
- Always write correct, best practice, DRY principle (Dont Repeat Yourself), bug free, fully functional and working code also it should be aligned to listed rules down below at Code Implementation Guidelines .
- Focus on easy and readability code, over being performant.
- Fully implement all requested functionality.
- Leave NO todo’s, placeholders or missing pieces.
- Ensure code is complete! Verify thoroughly finalised.
- Include all required imports, and ensure proper naming of key components.
- Be concise Minimize any other prose.
- If you think there might not be a correct answer, you say so.
- If you do not know the answer, say so, instead of guessing.

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
- **Route Groups**: Don't confuse route groups like `/(admin)/page.tsx` with nested routing. Route groups (parentheses) are not recognized as part of the routing structure. Having `/(admin)/page.tsx` and `/page.tsx` will cause conflicts as they both represent the root page.
- **Avoid Overusing useEffect**: Best practice is server-side data fetching. Create data fetching utilities in a DAL (Data Access Layer) and call them from Server Components instead of using useEffect in Client Components.
- **Implement Streaming Data Fetching**: When using Server Components for data fetching, implement streaming with Suspense boundaries for skeleton states. This provides better UX with progressive loading.
- **Prefer Server Actions**: When implementing forms or mutations, explicitly use Server Actions instead of defaulting to event handlers. Server Actions provide better type safety and reduce client-server round trips.
- **Async Params and SearchParams**: When accessing dynamic route params (`/blog/[id]`) or searchParams via `useSearchParams`, remember these are now async in Next.js 14+. Always use async/await to prevent errors.
- **Supabase Client Usage**: Use `createServerClient()` for server-side operations (Server Components, Server Actions, Route Handlers) and `createClient()` for client-side operations. Import from `@supabase/supabase-js` and `@supabase/ssr` modules.

### Code Implementation Guidelines

Follow these rules when you write code:
- Use early returns whenever possible to make the code more readable.
- Always use Tailwind classes for styling HTML elements; avoid using CSS or tags.
- Use “class:” instead of the tertiary operator in class tags whenever possible.
- Use descriptive variable and function/const names. Also, event functions should be named with a “handle” prefix, like “handleClick” for onClick and “handleKeyDown” for onKeyDown.
- Implement accessibility features on elements. For example, a tag should have a tabindex=“0”, aria-label, on:click, and on:keydown, and similar attributes.
- Use consts instead of functions, for example, “const toggle = () =>”. Also, define a type if possible.
