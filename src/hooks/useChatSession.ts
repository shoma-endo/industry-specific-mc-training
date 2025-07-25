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

export type { ChatSessionActions, ChatSessionHook };

const MAX_MESSAGES = 10;

export const useChatSession = (
  chatService: IChatService,
  getAccessToken: () => Promise<string>
): ChatSessionHook => {
  const [state, setState] = useState<ChatState>(initialChatState);

  const sendMessage = useCallback(
    async (content: string, model: string) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const accessToken = await getAccessToken();
        const recentMessages = state.messages.slice(-MAX_MESSAGES);

        const params: SendMessageParams = {
          content,
          model,
          accessToken,
          sessionId: state.currentSessionId ? state.currentSessionId : undefined,
          isNewSession: !state.currentSessionId,
          messages: recentMessages.map(msg => ({
            role: msg.role,
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
    [chatService, state.currentSessionId, state.messages, getAccessToken]
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
