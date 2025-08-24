'use client';

import { useState, useCallback } from 'react';
import { IChatService, SendMessageParams } from '@/domain/interfaces/IChatService';
import {
  ChatState,
  initialChatState,
  createUserMessage,
  createAssistantMessage,
} from '@/domain/models/chat.models';
import { ChatError } from '@/domain/errors/ChatError';
import type { ChatSessionActions, ChatSessionHook } from '@/types/hooks';
import { MODEL_CONFIGS } from '@/lib/constants';

export type { ChatSessionActions, ChatSessionHook };

const MAX_MESSAGES = 10;

export const useChatSession = (
  chatService: IChatService,
  getAccessToken: () => Promise<string>
): ChatSessionHook => {
  const [state, setState] = useState<ChatState>(initialChatState);

  const handleStreamingMessage = useCallback(
    async (
      content: string,
      model: string,
      accessToken: string,
      recentMessages: { role: string; content: string }[]
    ) => {
      const userMessage = createUserMessage(content);
      const assistantMessage = createAssistantMessage('', model);

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage, assistantMessage],
      }));

      try {
        const response = await fetch('/api/chat/anthropic/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            sessionId: state.currentSessionId || undefined,
            messages: recentMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
            })),
            userMessage: content,
            model,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
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

                  if (!state.currentSessionId && data.sessionId) {
                    const newSession = {
                      id: data.sessionId,
                      title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
                      updatedAt: new Date(),
                      messageCount: 1,
                      lastMessage: content,
                    };
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
        }));
      }
    },
    [state.currentSessionId]
  );

  const handleNonStreamingMessage = useCallback(
    async (
      content: string,
      model: string,
      accessToken: string,
      recentMessages: { role: string; content: string }[]
    ) => {
      const params: SendMessageParams = {
        content,
        model,
        accessToken,
        sessionId: state.currentSessionId ? state.currentSessionId : undefined,
        isNewSession: !state.currentSessionId,
        messages: recentMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      };

      const userMessage = createUserMessage(content);
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      const response = await chatService.sendMessage(params);

      if (response.error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: response.error || '送信に失敗しました',
        }));
        return;
      }

      const assistantMessage = createAssistantMessage(response.message, model);

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        currentSessionId: response.sessionId || prev.currentSessionId,
        isLoading: false,
      }));

      // 新しいチャット開始時にセッション一覧を更新
      if (params.isNewSession && response.sessionId) {
        const newSession = {
          id: response.sessionId,
          title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
          updatedAt: new Date(),
          messageCount: 1,
          lastMessage: content,
        };

        setState(prev => ({
          ...prev,
          sessions: [newSession, ...prev.sessions],
        }));
      }
    },
    [chatService, state.currentSessionId]
  );

  const sendMessage = useCallback(
    async (content: string, model: string) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const accessToken = await getAccessToken();
        const recentMessages = state.messages.slice(-MAX_MESSAGES);

        // Anthropicモデルの場合はストリーミングを使用
        const modelConfig = MODEL_CONFIGS[model];
        const isAnthropicModel = modelConfig?.provider === 'anthropic';

        if (isAnthropicModel) {
          await handleStreamingMessage(content, model, accessToken, recentMessages);
        } else {
          await handleNonStreamingMessage(content, model, accessToken, recentMessages);
        }
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
        }));
      }
    },
    [state.messages, getAccessToken, handleStreamingMessage, handleNonStreamingMessage]
  );

  const loadSessions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const sessions = await chatService.loadSessions();
      setState(prev => ({ ...prev, sessions, isLoading: false }));
    } catch (error) {
      console.error('Load sessions error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'セッション一覧の読み込みに失敗しました';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
    }
  }, [chatService]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

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
        setState(prev => ({ ...prev, error: errorMessage }));
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
    }));
  }, []);

  const actions: ChatSessionActions = {
    sendMessage,
    loadSessions,
    loadSession,
    deleteSession,
    startNewSession,
  };

  return {
    state,
    actions,
  };
};
