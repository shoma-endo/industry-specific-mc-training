import type { ChatMessage } from '@/domain/interfaces/IChatService';
import { BLOG_STEP_IDS, type BlogStepId } from '@/lib/constants';

const BLOG_MODEL_PREFIX = 'blog_creation_';

export interface CanvasStructuredContent {
  markdown?: string;
  html?: string;
}

const isBlogStepId = (value: string): value is BlogStepId =>
  BLOG_STEP_IDS.includes(value as BlogStepId);

const extractBlogStepFromModel = (model?: string): BlogStepId | null => {
  if (!model || !model.startsWith(BLOG_MODEL_PREFIX)) return null;
  const candidate = model.slice(BLOG_MODEL_PREFIX.length);
  return isBlogStepId(candidate) ? candidate : null;
};

const findLatestAssistantBlogStep = (messages: ChatMessage[]): BlogStepId | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.role !== 'assistant') continue;
    const step = extractBlogStepFromModel(message.model);
    if (step) return step;
  }
  return null;
};

const extractCanvasStructuredContent = (raw: string): CanvasStructuredContent | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const jsonCandidate = (fencedMatch?.[1] ?? trimmed).trim();
  const start = jsonCandidate.indexOf('{');
  const end = jsonCandidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonCandidate.slice(start, end + 1));
    const markdownCandidate =
      parsed.markdown ?? parsed.full_markdown ?? parsed.canvas_markdown ?? null;
    const htmlCandidate =
      parsed.replacement_html ?? parsed.replacement ?? parsed.full_html ?? parsed.html ?? null;

    const result: CanvasStructuredContent = {};

    if (typeof markdownCandidate === 'string' && markdownCandidate.trim().length > 0) {
      result.markdown = markdownCandidate.trim();
    }

    if (typeof htmlCandidate === 'string' && htmlCandidate.trim().length > 0) {
      result.html = htmlCandidate.trim();
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.warn('Failed to parse canvas version JSON:', error);
  }

  return null;
};

const htmlToMarkdownForCanvas = (html: string): string => {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1')
    .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1')
    .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1')
    .replace(/<h4[^>]*>(.*?)<\/h4>/g, '#### $1')
    .replace(/<h5[^>]*>(.*?)<\/h5>/g, '##### $1')
    .replace(/<h6[^>]*>(.*?)<\/h6>/g, '###### $1')
    .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n');
    })
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (match, content) => {
      let counter = 1;
      return content.replace(/<li[^>]*>(.*?)<\/li>/g, () => `${counter++}. $1\n`);
    })
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/g, '![$2]($1)')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
    .replace(/\n\n+/g, '\n\n')
    .trim();
};

const normalizeCanvasContent = (raw: string): string => {
  if (!raw) return '';
  const structured = extractCanvasStructuredContent(raw);
  if (!structured) {
    return raw;
  }
  if (structured.markdown) {
    return structured.markdown;
  }
  if (structured.html) {
    return htmlToMarkdownForCanvas(structured.html);
  }
  return raw;
};

export {
  BLOG_MODEL_PREFIX,
  extractBlogStepFromModel,
  findLatestAssistantBlogStep,
  normalizeCanvasContent,
  htmlToMarkdownForCanvas,
  extractCanvasStructuredContent,
  isBlogStepId,
};

export type { CanvasStructuredContent };
