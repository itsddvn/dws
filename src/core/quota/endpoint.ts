import fs from 'node:fs';
import { resolveAppPaths, type AppPaths } from '../../config/paths';
import { redactJson } from '../../db/redact';
import { resolveProfilePaths } from '../profiles/paths';

export interface RawQuotaPayload {
  daily_remaining_pct?: number | null;
  weekly_remaining_pct?: number | null;
  daily_reset_at?: number | string | null;
  weekly_reset_at?: number | string | null;
  used_prompt_credits?: number | null;
  available_prompt_credits?: number | null;
  used_flow_credits?: number | null;
  available_flow_credits?: number | null;
  used_flex_credits?: number | null;
  available_flex_credits?: number | null;
  [key: string]: unknown;
}

export interface QuotaSnapshotInput {
  source: string;
  daily_remaining_pct: number | null;
  weekly_remaining_pct: number | null;
  daily_reset_at: number | null;
  weekly_reset_at: number | null;
  used_prompt_credits: number | null;
  available_prompt_credits: number | null;
  used_flow_credits: number | null;
  available_flow_credits: number | null;
  used_flex_credits: number | null;
  available_flex_credits: number | null;
  raw_json: string;
}

export interface FetchQuotaOptions {
  appPaths?: AppPaths;
  endpointUrl?: string;
  fetchImpl?: typeof fetch;
}

export class QuotaAuthError extends Error {}
export class QuotaRateLimitError extends Error {}
export class QuotaTemporaryError extends Error {}

export async function fetchQuotaForProfile(accountId: string, options: FetchQuotaOptions = {}): Promise<QuotaSnapshotInput> {
  const endpointUrl = options.endpointUrl ?? process.env.DSW_QUOTA_ENDPOINT_URL;
  if (!endpointUrl) {
    throw new QuotaTemporaryError('Quota endpoint is not configured');
  }
  enforceSafeEndpoint(endpointUrl);

  const token = readProfileJwt(accountId, options.appPaths ?? resolveAppPaths());
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(endpointUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (response.status === 401 || response.status === 403) {
    throw new QuotaAuthError(`Quota endpoint rejected credentials with HTTP ${response.status}`);
  }
  if (response.status === 429) {
    throw new QuotaRateLimitError('Quota endpoint rate limited the request');
  }
  if (!response.ok) {
    throw new QuotaTemporaryError(`Quota endpoint returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as RawQuotaPayload;
  return normalizeQuotaPayload(payload);
}

export function readProfileJwt(accountId: string, appPaths: AppPaths = resolveAppPaths()): string {
  const credentialsPath = resolveProfilePaths(accountId, appPaths).credentialsPath;
  const body = fs.readFileSync(credentialsPath, 'utf8');
  const match =
    body.match(/devin-session-token\$[A-Za-z0-9._-]+/) ??
    body.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (!match?.[0]) {
    throw new QuotaAuthError(`No Devin token found in profile credentials: ${credentialsPath}`);
  }
  return match[0];
}

export function normalizeQuotaPayload(payload: RawQuotaPayload): QuotaSnapshotInput {
  const raw = redactJson(payload);
  return {
    source: 'server',
    daily_remaining_pct: pct(readNumber(payload.daily_remaining_pct ?? payload.dailyRemainingPct)),
    weekly_remaining_pct: pct(readNumber(payload.weekly_remaining_pct ?? payload.weeklyRemainingPct)),
    daily_reset_at: readTimestamp(payload.daily_reset_at ?? payload.dailyResetAt),
    weekly_reset_at: readTimestamp(payload.weekly_reset_at ?? payload.weeklyResetAt),
    used_prompt_credits: readNumber(payload.used_prompt_credits ?? payload.usedPromptCredits),
    available_prompt_credits: readNumber(payload.available_prompt_credits ?? payload.availablePromptCredits),
    used_flow_credits: readNumber(payload.used_flow_credits ?? payload.usedFlowCredits),
    available_flow_credits: readNumber(payload.available_flow_credits ?? payload.availableFlowCredits),
    used_flex_credits: readNumber(payload.used_flex_credits ?? payload.usedFlexCredits),
    available_flex_credits: readNumber(payload.available_flex_credits ?? payload.availableFlexCredits),
    raw_json: JSON.stringify(raw)
  };
}

function enforceSafeEndpoint(endpointUrl: string): void {
  const parsed = new URL(endpointUrl);
  if (parsed.protocol !== 'https:' && process.env.DSW_ALLOW_INSECURE !== '1') {
    throw new QuotaTemporaryError('Quota endpoint must use HTTPS unless DSW_ALLOW_INSECURE=1');
  }
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return readTimestamp(numeric);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }
  return null;
}

function pct(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Math.max(0, Math.min(100, value));
}
