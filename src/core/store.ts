import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAppPaths, type AppPaths } from '../config/paths';

export interface QuotaSnapshot {
  fetchedAt: number;
  dailyRemainingPct: number | null;
  weeklyRemainingPct: number | null;
  usedPromptCredits: number | null;
  availablePromptCredits: number | null;
  usedFlowCredits: number | null;
  availableFlowCredits: number | null;
  usedFlexCredits: number | null;
  availableFlexCredits: number | null;
  rawOutput: string;
}

export interface Account {
  id: string;
  name: string;
  email: string | null;
  tier: string | null;
  plan: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  needsLogin: boolean;
  quota: QuotaSnapshot | null;
}

interface StoreFile {
  version: 1;
  accounts: Account[];
}

const DEFAULT_STORE: StoreFile = { version: 1, accounts: [] };

export class AccountStore {
  private cache: StoreFile | null = null;

  constructor(private readonly paths: AppPaths = resolveAppPaths()) {}

  get storePath(): string {
    return this.paths.storePath;
  }

  list(): Account[] {
    return [...this.load().accounts];
  }

  findByName(name: string): Account | null {
    return this.load().accounts.find((account) => account.name === name) ?? null;
  }

  getByName(name: string): Account {
    const account = this.findByName(name);
    if (!account) throw new Error(`Account not found: ${name}`);
    return account;
  }

  create(name: string): Account {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Account name is required');
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      throw new Error('Account name may only contain letters, numbers, underscores, and dashes');
    }
    const file = this.load();
    if (file.accounts.some((account) => account.name === trimmed)) {
      throw new Error(`Account already exists: ${trimmed}`);
    }
    const account: Account = {
      id: crypto.randomUUID(),
      name: trimmed,
      email: null,
      tier: null,
      plan: null,
      createdAt: nowSeconds(),
      lastUsedAt: null,
      needsLogin: true,
      quota: null
    };
    file.accounts.push(account);
    this.save(file);
    return account;
  }

  remove(name: string): Account {
    const file = this.load();
    const index = file.accounts.findIndex((account) => account.name === name);
    if (index === -1) throw new Error(`Account not found: ${name}`);
    const [removed] = file.accounts.splice(index, 1);
    this.save(file);
    return removed!;
  }

  update(id: string, updater: (account: Account) => Account): Account {
    const file = this.load();
    const index = file.accounts.findIndex((account) => account.id === id);
    if (index === -1) throw new Error(`Account not found by id: ${id}`);
    const next = updater({ ...file.accounts[index]! });
    file.accounts[index] = next;
    this.save(file);
    return next;
  }

  setAuthMetadata(id: string, metadata: { email?: string | null; tier?: string | null; plan?: string | null }): Account {
    return this.update(id, (account) => ({
      ...account,
      email: metadata.email ?? account.email,
      tier: metadata.tier ?? account.tier,
      plan: metadata.plan ?? account.plan,
      needsLogin: false
    }));
  }

  markNeedsLogin(id: string): Account {
    return this.update(id, (account) => ({ ...account, needsLogin: true }));
  }

  setQuota(id: string, snapshot: QuotaSnapshot): Account {
    return this.update(id, (account) => ({ ...account, quota: snapshot }));
  }

  touchLastUsed(id: string): Account {
    return this.update(id, (account) => ({ ...account, lastUsedAt: nowSeconds() }));
  }

  reload(): void {
    this.cache = null;
  }

  private load(): StoreFile {
    if (this.cache) return this.cache;
    if (!fs.existsSync(this.paths.storePath)) {
      this.cache = structuredClone(DEFAULT_STORE);
      return this.cache;
    }
    const raw = fs.readFileSync(this.paths.storePath, 'utf8');
    try {
      const parsed = JSON.parse(raw) as Partial<StoreFile>;
      this.cache = {
        version: 1,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts.map(normalizeAccount) : []
      };
      return this.cache;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read accounts store at ${this.paths.storePath}: ${message}`);
    }
  }

  private save(file: StoreFile): void {
    fs.mkdirSync(path.dirname(this.paths.storePath), { recursive: true, mode: 0o700 });
    const tmp = `${this.paths.storePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(file, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.paths.storePath);
    this.cache = file;
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function normalizeAccount(raw: unknown): Account {
  const account = raw as Partial<Account>;
  return {
    id: String(account.id ?? crypto.randomUUID()),
    name: String(account.name ?? ''),
    email: account.email ?? null,
    tier: account.tier ?? null,
    plan: account.plan ?? null,
    createdAt: typeof account.createdAt === 'number' ? account.createdAt : nowSeconds(),
    lastUsedAt: typeof account.lastUsedAt === 'number' ? account.lastUsedAt : null,
    needsLogin: account.needsLogin === true,
    quota: account.quota ?? null
  };
}
