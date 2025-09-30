'use client';

import { create } from 'zustand';

type SavedFields = {
  needs?: boolean;
  persona?: boolean;
  goal?: boolean;
  prep?: boolean;
  basic_structure?: boolean;
  opening_proposal?: boolean;
};

type SessionAnnotationState = {
  [sessionId: string]: SavedFields;
};

type AnnotationStore = {
  sessions: SessionAnnotationState;
  setSavedFields: (sessionId: string, fields: SavedFields) => void;
  markFieldAsSaved: (sessionId: string, fieldName: keyof SavedFields) => void;
  getSavedFields: (sessionId: string) => SavedFields;
  clearSession: (sessionId: string) => void;
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  sessions: {},

  setSavedFields: (sessionId, fields) =>
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { ...state.sessions[sessionId], ...fields },
      },
    })),

  markFieldAsSaved: (sessionId, fieldName) =>
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...state.sessions[sessionId],
          [fieldName]: true,
        },
      },
    })),

  getSavedFields: sessionId => {
    return get().sessions[sessionId] ?? {};
  },

  clearSession: sessionId =>
    set(state => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [sessionId]: _, ...rest } = state.sessions;
      return { sessions: rest };
    }),
}));
