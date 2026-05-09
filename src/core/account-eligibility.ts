import type { AccountQuota } from './quota';
import type { Account } from './store';

export function isKnownFreeAccount(account: Account): boolean {
  return isFreeLabel(account.tier) || isFreeLabel(account.plan);
}

export function isTrialAccount(account: Account, quota: AccountQuota | undefined): boolean {
  return isTrialLabel(quota?.summary.tier) || isTrialLabel(account.tier) || isTrialLabel(account.plan);
}

export function normalizeKnownTierLabel(value: string | undefined | null): 'Free' | 'Trial' | null {
  if (isFreeLabel(value)) return 'Free';
  if (isTrialLabel(value)) return 'Trial';
  return null;
}

function isTrialLabel(value: string | undefined | null): boolean {
  return normalizedPlanLabel(value).startsWith('trial');
}

function isFreeLabel(value: string | undefined | null): boolean {
  return normalizedPlanLabel(value).startsWith('free');
}

function normalizedPlanLabel(value: string | undefined | null): string {
  return value?.trim().toLowerCase().replace(/[^a-z]/g, '') ?? '';
}
