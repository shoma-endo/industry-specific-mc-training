export interface Ga4PropertySummary {
  propertyId: string;
  displayName: string;
  accountId?: string | null;
  accountName?: string | null;
}

export interface Ga4KeyEvent {
  name: string;
  eventName: string;
}

export interface Ga4ConnectionStatus {
  connected: boolean;
  needsReauth?: boolean;
  scopeMissing?: boolean;
  googleAccountEmail?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  conversionEvents?: string[] | null;
  thresholdEngagementSec?: number | null;
  thresholdReadRate?: number | null;
  lastSyncedAt?: string | null;
  updatedAt?: string | null;
}

export interface Ga4PageMetricSummary {
  normalizedPath: string;
  dateFrom: string;
  dateTo: string;
  sessions: number;
  users: number;
  engagementTimeSec: number;
  bounceRate: number; // 0-1
  cvEventCount: number;
  scroll90EventCount: number;
  isSampled: boolean;
  isPartial: boolean;
}

export interface Ga4DailyMetricRow {
  userId: string;
  propertyId: string;
  date: string;
  pagePath: string;
  normalizedPath: string;
  sessions: number;
  users: number;
  engagementTimeSec: number;
  bounceRate: number;
  cvEventCount: number;
  scroll90EventCount: number;
  isSampled: boolean;
  isPartial: boolean;
  importedAt: string;
}
