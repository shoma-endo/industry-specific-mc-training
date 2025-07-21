export interface SubscriptionDetails {
  readonly id: string;
  readonly status: 'active' | 'canceled' | 'past_due' | 'trialing';
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEnd: Date;
  readonly planName?: string | undefined;
}

export interface SubscriptionStatus {
  readonly hasActiveSubscription: boolean;
  readonly requiresSubscription: boolean;
  readonly subscription?: SubscriptionDetails | undefined;
  readonly error?: string | undefined;
}

export interface ISubscriptionService {
  checkSubscription(accessToken: string): Promise<SubscriptionStatus>;
  hasActiveSubscription(): boolean;
  getSubscriptionDetails(): SubscriptionDetails | null;
}