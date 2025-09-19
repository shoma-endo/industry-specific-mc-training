# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains Next.js App Router routes; keep layouts minimal and co-locate feature-specific components.
- `src/` hosts reusable code: `components/` (shadcn UI), `domain/` (business logic), `server/` (server actions and integrations), `lib/` helpers, `types/` shared contracts, and `hooks/` composition utilities.
- Database assets live in `supabase/migrations/`; pair any schema change with clear rollback notes.
- Root configs (`eslint.config.mjs`, `.prettierrc`, `next.config.ts`) are source-of-truth; update them rather than creating per-folder overrides.

## Build, Test, and Development Commands
- `npm run dev`: type-check with `tsc-watch` then launch `next dev --turbopack`.
- `npm run build` / `npm run start`: production build and runtime smoke test; run before merging backend or routing edits.
- `npm run lint`: ESLint with Next and Tailwind rules; invoked by Husky `pre-commit`.
- `npm run ngrok`: expose port 3000 during LIFF or mobile QA sessions.
- `npx supabase db push`: sync PostgreSQL schema from `supabase/migrations/` after editing SQL or RLS policies.

## Coding Style & Naming Conventions
- TypeScript-first: export explicit types from `src/types/` and reuse them in server actions.
- Prettier (2-space indent, single quotes, semicolons, 100-char width) governs formatting; run `npx prettier --write <file>` when editors drift.
- Components/hooks use PascalCase and camelCase names; keep server-only utilities suffixed with `.server.ts` or `.action.ts`.
- Tailwind classes should remain purposeful—derive variants through `cva` utilities in `src/components/ui`.

## Testing Guidelines
- No automated suite is wired yet; add new tests alongside implementations (e.g., `src/domain/foo.test.ts`) and expose them via a script such as `npm run test` when introduced.
- Validate flows manually today: run `npm run dev`, perform LIFF sign-in, exercise Supabase writes, and inspect network logs for Stripe or WordPress calls.
- Capture reproduction steps and sample payloads in PRs so reviewers can replay changes quickly.

## Commit & Pull Request Guidelines
- Follow the existing concise, present-tense commit style (often Japanese verbs, e.g., `チャット保存機能削除`); keep each commit single-purpose.
- Always run `npm run lint` before committing; Husky blocks failures.
- PRs should outline user impact, deployment or env updates, linked issues, and include screenshots/GIFs for UI updates under `app/`.
- Highlight Supabase migrations or env schema changes in the description so deployers can coordinate secrets and rollbacks.
