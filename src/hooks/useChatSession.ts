'use client';

import { useState, useCallback } from 'react';
import { ChatMessage, ChatSession, IChatService } from '@/domain/interfaces/IChatService';
import {
  ChatState,
  initialChatState,
  createUserMessage,
  createAssistantMessage,
} from '@/domain/models/chat.models';
import { ChatError } from '@/domain/errors/ChatError';
import type { ChatSessionActions, ChatSessionHook } from '@/types/hooks';
import { ERROR_MESSAGES } from '@/lib/constants';

export type { ChatSessionActions, ChatSessionHook };

const MAX_MESSAGES = 10;

interface SerializableMessage {
  role: string;
  content: string;
}

const createRequestMessages = (messages: ChatMessage[]): SerializableMessage[] =>
  messages.slice(-MAX_MESSAGES).map(({ role, content }) => ({ role, content }));

const createSessionPreview = (content: string, sessionId: string): ChatSession => ({
  id: sessionId,
  title: content.length > 30 ? `${content.slice(0, 30)}...` : content,
  updatedAt: new Date(),
  messageCount: 1,
  lastMessage: content,
});

const createStreamingMessagePair = (content: string, model: string) => ({
  userMessage: createUserMessage(content, model),
  assistantMessage: createAssistantMessage('', model),
});

interface StreamingParams {
  content: string;
  model: string;
  accessToken: string;
  currentSessionId: string;
  recentMessages: SerializableMessage[];
  systemPrompt?: string;
}

export const useChatSession = (
  chatService: IChatService,
  getAccessToken: () => Promise<string>
): ChatSessionHook => {
  const [state, setState] = useState<ChatState>(initialChatState);

  const handleStreamingMessage = useCallback(
    async ({
      content,
      model,
      accessToken,
      currentSessionId,
      recentMessages,
      systemPrompt,
    }: StreamingParams) => {
      const { userMessage, assistantMessage } = createStreamingMessagePair(content, model);

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage, assistantMessage],
        error: null,
        warning: null,
      }));

      try {
        const response = await fetch('/api/chat/anthropic/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            sessionId: currentSessionId || undefined,
            messages: recentMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
            })),
            userMessage: content,
            model,
            ...(systemPrompt ? { systemPrompt } : {}),
          }),
        });

        if (response.status === 429) {
          const bodyText = await response.text().catch(() => '');
          const warningMessage = extractWarningMessage(bodyText);

          setState(prev => {
            const updatedMessages =
              prev.messages.length > 0 && prev.messages[prev.messages.length - 1]?.role === 'assistant'
                ? prev.messages.slice(0, -1)
                : prev.messages;

            return {
              ...prev,
              messages: updatedMessages,
              warning: warningMessage,
              error: null,
              isLoading: false,
            };
          });

          return;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response stream');
        }

        let accumulatedText = '';
        let idleTimeout: ReturnType<typeof setTimeout> | null = null;
        let sseBuffer = '';

        const resetIdleTimeout = () => {
          if (idleTimeout) clearTimeout(idleTimeout);
          idleTimeout = setTimeout(() => {
            console.warn('Stream idle timeout');
            reader.cancel();
          }, 120000); // 2分のタイムアウト
        };

        resetIdleTimeout();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            resetIdleTimeout();

            const chunkText = new TextDecoder().decode(value);
            sseBuffer += chunkText;

            // SSEイベントは空行で区切られる
            const events = sseBuffer.split('\n\n');
            sseBuffer = events.pop() || '';

            for (const eventBlock of events) {
              if (!eventBlock.trim()) continue;
              const lines = eventBlock.split('\n');
              const eventType = lines
                .find(l => l.startsWith('event: '))
                ?.slice(7)
                ?.trim();
              if (!eventType) continue;

              // 複数 data: 行を結合
              const dataCombined = lines
                .filter(l => l.startsWith('data: '))
                .map(l => l.slice(6))
                .join('\n');

              try {
                if (eventType === 'chunk') {
                  const data = JSON.parse(dataCombined);
                  accumulatedText += data; // サーバーはJSON文字列を送る
                  setState(prev => ({
                    ...prev,
                    messages: prev.messages.map((msg, idx) =>
                      idx === prev.messages.length - 1 ? { ...msg, content: accumulatedText } : msg
                    ),
                  }));
                } else if (eventType === 'final') {
                  const data = JSON.parse(dataCombined);
                  setState(prev => ({
                    ...prev,
                    currentSessionId: data.sessionId || prev.currentSessionId,
                    messages: prev.messages.map((msg, idx) =>
                      idx === prev.messages.length - 1 ? { ...msg, content: data.message } : msg
                    ),
                    isLoading: false,
                  }));

                  if (!currentSessionId && data.sessionId) {
                    const newSession = createSessionPreview(content, data.sessionId);
                    setState(prev => ({
                      ...prev,
                      sessions: [newSession, ...prev.sessions],
                    }));
                  }
                } else if (eventType === 'error') {
                  const data = JSON.parse(dataCombined);
                  throw new Error(data.message || 'ストリーミングエラー');
                } else if (eventType === 'usage' || eventType === 'meta') {
                  try {
                    console.log(`[Stream ${eventType}]`, JSON.parse(dataCombined));
                  } catch {}
                } else if (eventType === 'done') {
                  // 明示終了
                  return;
                }
              } catch (e) {
                console.warn('Failed to parse SSE event:', eventType, e);
              }
            }
          }
        } finally {
          if (idleTimeout) clearTimeout(idleTimeout);
          reader.releaseLock();
        }
      } catch (error) {
        console.error('Streaming error:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'ストリーミングに失敗しました',
          warning: null,
        }));
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (content: string, model: string, options?: { systemPrompt?: string }) => {
      setState(prev => ({ ...prev, isLoading: true, error: null, warning: null }));

      try {
        const accessToken = await getAccessToken();
        const streamingParams: StreamingParams = {
          content,
          model,
          accessToken,
          currentSessionId: state.currentSessionId,
          recentMessages: createRequestMessages(state.messages),
        };

        if (options?.systemPrompt) {
          streamingParams.systemPrompt = options.systemPrompt;
        }

        await handleStreamingMessage(streamingParams);
      } catch (error) {
        console.error('Send message error:', error);
        const errorMessage =
          error instanceof ChatError
            ? error.userMessage
            : error instanceof Error
              ? error.message
              : '送信に失敗しました';

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          warning: null,
        }));
      }
    },
    [state.currentSessionId, state.messages, getAccessToken, handleStreamingMessage]
  );

  const loadSessions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null, warning: null }));
      const sessions = await chatService.loadSessions();
      setState(prev => ({ ...prev, sessions, isLoading: false }));
    } catch (error) {
      console.error('Load sessions error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'セッション一覧の読み込みに失敗しました';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false, warning: null }));
    }
  }, [chatService]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      setState(prev => ({ ...prev, isLoading: true, error: null, warning: null }));

      try {
        const messages = await chatService.loadSessionMessages(sessionId);
        setState(prev => ({
          ...prev,
          messages,
          currentSessionId: sessionId,
          isLoading: false,
        }));
      } catch (error) {
        console.error('Load session error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'セッションの読み込みに失敗しました';
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          warning: null,
        }));
      }
    },
    [chatService]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await chatService.deleteSession(sessionId);
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.filter(s => s.id !== sessionId),
          // 削除されたセッションが現在のセッションの場合、新しいチャットを開始
          ...(prev.currentSessionId === sessionId
            ? {
                currentSessionId: '',
                messages: [],
              }
            : {}),
        }));
      } catch (error) {
        console.error('Delete session error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'セッションの削除に失敗しました';
        setState(prev => ({ ...prev, error: errorMessage, warning: null }));
      }
    },
    [chatService]
  );

  const updateSessionTitle = useCallback(
    async (sessionId: string, title: string) => {
      try {
        await chatService.updateSessionTitle(sessionId, title);
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.map(session =>
            session.id === sessionId ? { ...session, title } : session
          ),
        }));
      } catch (error) {
        console.error('Update session title error:', error);
        if (error instanceof ChatError) {
          throw error;
        }
        throw new Error(
          error instanceof Error ? error.message : 'チャットタイトルの更新に失敗しました'
        );
      }
    },
    [chatService]
  );

  const startNewSession = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentSessionId: '',
      messages: [],
      error: null,
      warning: null,
    }));
  }, []);

  const actions: ChatSessionActions = {
    sendMessage,
    loadSessions,
    loadSession,
    deleteSession,
    updateSessionTitle,
    startNewSession,
  };

  return {
    state,
    actions,
  };
};

function extractWarningMessage(rawBody: string): string {
  if (!rawBody) {
    return ERROR_MESSAGES.daily_chat_limit;
  }

  const dataMatch = rawBody.match(/data:\s*(\{.*\})/);
  if (dataMatch) {
    const payload = dataMatch[1];
    if (!payload) {
      return ERROR_MESSAGES.daily_chat_limit;
    }
    try {
      const parsed = JSON.parse(payload) as { message?: unknown };
      if (parsed && typeof parsed === 'object' && typeof parsed.message === 'string') {
        return parsed.message;
      }
    } catch {
      // no-op fall back to default
    }
  }

  return ERROR_MESSAGES.daily_chat_limit;
}
