export type OutputTrigger = 'quota' | 'rate-limit' | 'recoverable-error';

export class OutputWatcher {
  private lastTriggerAt = 0;
  private buffer = '';

  constructor(private readonly debounceMs = 10_000) {}

  push(chunk: string): OutputTrigger | null {
    const cleaned = stripAnsi(chunk);
    this.buffer = (this.buffer + cleaned).slice(-4_000);
    const trigger = detectTrigger(this.buffer);
    if (!trigger) return null;
    const now = Date.now();
    if (now - this.lastTriggerAt < this.debounceMs) return null;
    this.lastTriggerAt = now;
    return trigger;
  }
}

function stripAnsi(value: string): string {
  return value.replace(ansiPattern, '');
}

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');

function detectTrigger(output: string): OutputTrigger | null {
  if (/rate limit (?:exceeded|reached)|rate-limit (?:exceeded|reached)|too many requests|error: .*rate limit/i.test(output)) {
    return 'rate-limit';
  }
  if (/quota has been exhausted|quota exhausted|usage limit/i.test(output)) return 'quota';
  if (/something went wrong/i.test(output) && /internal error occurred/i.test(output)) return 'recoverable-error';
  return null;
}
