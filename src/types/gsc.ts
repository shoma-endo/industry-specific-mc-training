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

export type GscEvaluationStage = 1 | 2 | 3 | 4;
export type GscEvaluationStatus = 'active' | 'paused' | 'completed';
export type GscEvaluationOutcome = 'improved' | 'no_change' | 'worse';

export interface GscArticleEvaluation {
  id: string;
  userId: string;
  contentAnnotationId: string;
  propertyUri: string;
  currentStage: GscEvaluationStage;
  lastEvaluatedOn?: string | null; // ISO date
  nextEvaluationOn: string; // ISO date
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
  stage: GscEvaluationStage;
  previousPosition?: number | null;
  currentPosition: number;
  outcome: GscEvaluationOutcome;
  suggestionApplied: boolean;
  suggestionSummary?: string | null;
  createdAt: string;
}
