export type AccountSignal =
  | { type: 'finish_reason'; value: string }
  | { type: 'output_line'; value: string }
  | { type: 'exit'; code: number | null };

export type SignalDecision =
  | { kind: 'limited'; reason: string }
  | { kind: 'needs_login'; reason: string }
  | { kind: 'cooldown'; reason: string; seconds: number }
  | { kind: 'info'; reason: string }
  | { kind: 'none' };

export function classifySignal(signal: AccountSignal): SignalDecision {
  if (signal.type === 'finish_reason') {
    switch (signal.value) {
      case 'quota_exhausted':
        return { kind: 'limited', reason: 'finish_reason:quota_exhausted' };
      case 'auth_required':
        return { kind: 'needs_login', reason: 'finish_reason:auth_required' };
      case 'max_turn_requests':
        return { kind: 'info', reason: 'finish_reason:max_turn_requests' };
      default:
        return { kind: 'none' };
    }
  }

  if (signal.type === 'output_line') {
    if (signal.value.includes('Quota exhausted')) {
      return { kind: 'limited', reason: 'output:quota_exhausted' };
    }
    if (signal.value.includes('Upgrade your plan or wait for your quota to reset')) {
      return { kind: 'limited', reason: 'output:upgrade_or_wait' };
    }
    if (signal.value.includes('Rate limited:')) {
      return { kind: 'cooldown', reason: 'output:rate_limited', seconds: 5 * 60 };
    }
    if (signal.value.includes('Turn limit reached')) {
      return { kind: 'info', reason: 'output:turn_limit' };
    }
    if (signal.value.includes('Failed to fetch quota:')) {
      return { kind: 'info', reason: 'output:quota_fetch_failed' };
    }
  }

  return { kind: 'none' };
}
