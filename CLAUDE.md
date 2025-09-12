# CLAUDE.md

必ず日本語で回答してください。
タスクを終えたら npx ccusage@latest を叩いて、コストを表示してください。
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last Updated**: September 12, 2025
**Framework Versions**: Next.js 15.3.1, React 19, TypeScript 5

## プロジェクト基本情報

このプロジェクトは **Next.js** で構築された **AI搭載マーケティングコピー生成アプリケーション** です。LINE LIFF認証とSupabaseデータベースを統合し、マルチプロバイダAI（OpenAI + Anthropic）を使用した高度なコンテンツ生成機能を提供します。

### 主要技術スタック

- **Frontend**: Next.js 15.3.1 + React 19 + TypeScript 5 + Tailwind CSS v4
- **Backend**: Next.js API Routes + Supabase (PostgreSQL)
- **Authentication**: LINE LIFF + JWTトークン自動更新
- **AI Services**: OpenAI GPT + Anthropic Claude（ストリーミング対応）
- **Payments**: Stripe サブスクリプションマネジメント
- **External APIs**: Google Custom Search + WordPress REST API

### プロジェクト特性

- **マルチテナント対応**: Supabase RLSによるデータ分離
- **リアルタイム処理**: WebSocketベースのストリーミングチャット
- **RAG統合**: ベクター検索によるコンテンツ拡張
- **モバイル最適化**: LINE LIFFによるモバイルファースト設計

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

## 共通コマンド

### 開発環境

```bash
# 開発サーバー起動（TypeScript監視コンパイル）
npm run dev

# 本番ビルド
npm run build

# コード品質チェック
npm run lint
```

### テスト・デバッグ

```bash
# LINE LIFF開発用にngrokで外部公開
npm run ngrok

# RAG処理用CSVデータクリーンアップ
npm run rag:clean
```

### ワークフロー

- **開発開始時**: `npm run dev` でサーバー起動
- **コード変更時**: 変更完了後に必ず `npm run lint` で品質チェック
- **LINE連携テスト時**: `npm run ngrok` で外部アクセスを有効化
- **本番デプロイ前**: `npm run build` でビルドテスト

## Architecture Overview

This is a Next.js application that provides AI-powered marketing copy generation with multi-service integration.

### Core Services Integration

- **Authentication**: LINE LIFF (LINE Frontend Framework) with automatic token refresh
- **Database**: Supabase with Row Level Security policies
- **Payments**: Stripe subscription management with feature gating
- **AI Services**:
  - **OpenAI**: API with fine-tuned models for keyword categorization and text generation
  - **Anthropic**: Claude models for advanced conversational AI with streaming support
- **RAG System**: Retrieval-Augmented Generation using vector search for enhanced content generation

### Authentication Flow

1. Users authenticate through LINE LIFF (`src/components/ClientLiffProvider.tsx`)
2. Access tokens are verified server-side (`src/server/services/lineAuthService.ts`)
3. Automatic token refresh handles expiration
4. All protected routes use `checkAuth()` middleware pattern
5. Subscription status gates feature access

### Chat System Architecture

The chat system uses multiple AI models and services in sequence:

1. **Fine-tuned Model**: `ft:gpt-4.1-nano-2025-04-14:personal::BZeCVPK2` classifies keywords
2. **Google Search**: Validates and researches keywords
3. **AI Generation**: Leverages multi-provider AI services for content generation
4. **RAG Enhancement**: Integrates vector search for enhanced content retrieval

All chat sessions are persisted in Supabase with user isolation. The system supports real-time streaming responses from integrated AI providers.

### Environment Configuration

Environment variables are type-safe using `@t3-oss/env-nextjs` in `src/env.ts`. Key integrations require:

- **LINE**: Channel ID and secret for LIFF authentication
- **Supabase**: URL and service role key for database operations
- **Stripe**: Product/price IDs and API keys for subscription management
- **AI Services**:
  - **OpenAI**: API key for chat completions and fine-tuned models
  - **Anthropic**: API key for Claude models and streaming
- **Google**: Search API key and Custom Search Engine ID
- **Webhooks**: BASE_WEBHOOK_URL and RELAY_BEARER_TOKEN for external integrations

### Key Code Patterns

**Service Layer**: All external API calls go through service classes in `src/server/services/`

**Error Handling**: Custom error types like `LineTokenExpiredError` with automatic recovery

**Type Safety**: Strict TypeScript with Zod validation for API responses

**Client/Server Separation**: Client components handle LIFF auth, server actions handle business logic

**AI Integration**: Unified multi-provider interface through `LLMService` with streaming support

### Database Schema

Supabase migrations in `supabase/migrations/` define:

- User profiles linked to LINE accounts
- Chat sessions and message history
- WordPress connection settings
- Content annotations for RAG system
- Prompt templates and chunks for AI generation
- Google search count tracking

### API Endpoints

#### Core Chat APIs

- `POST /api/chat/anthropic/stream` - Anthropic Claude streaming chat
- `POST /api/refresh` - Token refresh and validation

#### Authentication APIs

- `POST /api/auth/check-role` - User role verification
- `POST /api/auth/clear-cache` - Authentication cache clearing
- `POST /api/line/callback` - LINE OAuth callback handling

#### User Management APIs

- `GET /api/user/current` - Current user profile
- `GET /api/user/search-count` - Google search usage tracking

#### WordPress Integration APIs

- `GET/POST /api/wordpress/settings` - WordPress connection settings
- `POST /api/wordpress/test-connection` - Connection testing
- `GET /api/wordpress/posts` - Post retrieval
- `GET/POST /api/wordpress/oauth/start` - OAuth flow initiation
- `GET/POST /api/wordpress/oauth/callback` - OAuth callback handling
- `GET /api/wordpress/status` - Connection status

#### Admin APIs

- `GET /api/admin/wordpress/stats` - WordPress usage statistics

#### Utility APIs

- `POST /api/log-relay` - External log forwarding

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
- Never use any in a type definition.
