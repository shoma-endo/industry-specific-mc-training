/**
 * コンポーネント専用の型定義
 */
import type { WordPressType } from './wordpress';

/**
 * LIFF関連の型定義
 */
export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LiffContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  profile: LiffProfile | null;
  user?: import('@/types/user').User | null;
  login: () => void;
  logout: () => void;
  liffObject: unknown;
  getAccessToken: () => Promise<string>;
}

export interface LiffProviderProps {
  children: React.ReactNode;
  initialize?: boolean;
}

/**
 * コンポーネントProps型定義
 */
export interface WordPressSettingsFormProps {
  liffAccessToken: string;
  existingSettings: ExistingWordPressSettings | null;
}

export interface ExistingWordPressSettings {
  id?: string;
  wpType: WordPressType;
  wpSiteId?: string;
  wpSiteUrl?: string;
  wpUsername?: string;
  wpApplicationPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SetupDashboardProps {
  wordpressSettings: WordPressSettingsState;
}

export interface WordPressSettingsState {
  hasSettings: boolean;
  type: 'wordpress_com' | 'self_hosted';
  siteId?: string;
  siteUrl?: string;
}

export interface SetupPageClientProps {
  liffAccessToken: string;
  hasWordPressSettings: boolean;
  // wordpressType は未使用のため削除
}

/**
 * セッションリスト関連の型定義
 */
export type SessionListItem = {
  id: string;
  title: string;
  updatedAt: Date;
};

export interface SessionListContentProps {
  sessions: SessionListItem[];
  sessionId: string;
  hoveredSessionId: string | null;
  onLoadSession: (id: string) => void;
  onDeleteClick: (session: SessionListItem, e: React.MouseEvent) => void;
  onStartNewChat: () => void;
  onHoverSession: (sessionId: string | null) => void;
  sessionListRef: React.RefObject<HTMLDivElement | null>;
  onToggleSidebar?: () => void;
  showToggleButton?: boolean;
}

/**
 * UI コンポーネント関連の型定義
 */
export interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

export interface DeleteChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  chatTitle: string;
  isDeleting?: boolean;
}
