export type GscPropertyType = 'sc-domain' | 'url-prefix';

export interface GscCredential {
  id: string;
  userId: string;
  googleAccountEmail?: string | null;
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: string | null;
  scope?: string[] | null;
  propertyUri?: string | null;
  propertyType?: GscPropertyType | null;
  propertyDisplayName?: string | null;
  permissionLevel?: string | null;
  verified?: boolean | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GscConnectionStatus {
  connected: boolean;
  googleAccountEmail?: string | null;
  propertyUri?: string | null;
  propertyDisplayName?: string | null;
  propertyType?: GscPropertyType | null;
  permissionLevel?: string | null;
  verified?: boolean | null;
  lastSyncedAt?: string | null;
  updatedAt?: string | null;
  scope?: string[] | null;
}

export interface GscSiteEntry {
  siteUrl: string;
  permissionLevel: string;
  propertyType: GscPropertyType;
  displayName: string;
  verified: boolean;
}

export type GscSearchType = 'web' | 'image' | 'news';

export interface GscPageMetric {
  id: string;
  userId: string;
  contentAnnotationId?: string | null;
  propertyUri: string;
  searchType: GscSearchType;
  date: string; // ISO date (YYYY-MM-DD)
  url: string;
  normalizedUrl?: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  importedAt: string;
}

export type GscEvaluationStatus = 'active' | 'paused' | 'completed';
export type GscEvaluationOutcome = 'improved' | 'no_change' | 'worse';

export interface GscEvaluationOutcomeConfig {
  label: string;
  className: string;
}

export const GSC_EVALUATION_OUTCOME_CONFIG: Record<GscEvaluationOutcome, GscEvaluationOutcomeConfig> = {
  improved: {
    label: '改善',
    className: 'bg-green-100 text-green-800',
  },
  no_change: {
    label: '変化なし',
    className: 'bg-yellow-100 text-yellow-800',
  },
  worse: {
    label: '悪化',
    className: 'bg-red-100 text-red-800',
  },
};

export interface GscArticleEvaluation {
  id: string;
  userId: string;
  contentAnnotationId: string;
  propertyUri: string;
  lastEvaluatedOn?: string | null; // ISO date
  baseEvaluationDate: string; // ISO date - 評価基準日（この日付 + 30日が初回評価日）
  lastSeenPosition?: number | null;
  status: GscEvaluationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GscArticleEvaluationHistory {
  id: string;
  userId: string;
  contentAnnotationId: string;
  evaluationDate: string; // ISO date
  previousPosition?: number | null;
  currentPosition: number;
  outcome: GscEvaluationOutcome;
  suggestionApplied: boolean;
  suggestionSummary?: string | null;
  createdAt: string;
}
