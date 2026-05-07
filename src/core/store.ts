import crypto from 'node:crypto';
import fs from 'node:fs';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { validateAccountName } from '../util/account-name';
import { atomicWriteJsonSync } from '../util/atomic-write';

export interface Account {
  id: string;
  name: string;
  email: string | null;
  tier: string | null;
  plan: string | null;
  orgId: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  needsLogin: boolean;
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
    const trimmed = validateAccountName(name);
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
      orgId: null,
      createdAt: nowSeconds(),
      lastUsedAt: null,
      needsLogin: true
    };
    file.accounts.push(account);
    this.save(file);
    return account;
  }

  rename(id: string, name: string): Account {
    const trimmed = validateAccountName(name);
    const file = this.load();
    const index = file.accounts.findIndex((account) => account.id === id);
    if (index === -1) throw new Error(`Account not found by id: ${id}`);
    if (file.accounts.some((account) => account.id !== id && account.name === trimmed)) {
      throw new Error(`Account already exists: ${trimmed}`);
    }
    file.accounts[index] = { ...file.accounts[index]!, name: trimmed };
    this.save(file);
    return file.accounts[index]!;
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

  setAuthMetadata(
    id: string,
    metadata: { email?: string | null; tier?: string | null; plan?: string | null; orgId?: string | null }
  ): Account {
    return this.update(id, (account) => ({
      ...account,
      email: metadata.email ?? account.email,
      tier: metadata.tier ?? account.tier,
      plan: metadata.plan ?? account.plan,
      orgId: metadata.orgId ?? account.orgId,
      needsLogin: false
    }));
  }

  markNeedsLogin(id: string): Account {
    return this.update(id, (account) => ({ ...account, needsLogin: true }));
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
    atomicWriteJsonSync(this.paths.storePath, file);
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
    orgId: account.orgId ?? null,
    createdAt: typeof account.createdAt === 'number' ? account.createdAt : nowSeconds(),
    lastUsedAt: typeof account.lastUsedAt === 'number' ? account.lastUsedAt : null,
    needsLogin: account.needsLogin === true
  };
}
