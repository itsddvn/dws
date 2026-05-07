export class PromptCapture {
  private current = '';
  private lastSafe: string | null = null;

  push(data: string): void {
    for (const char of data) {
      if (char === '\u0003') {
        this.current = '';
        continue;
      }
      if (char === '\b' || char === '\u007f') {
        this.current = this.current.slice(0, -1);
        continue;
      }
      if (char === '\r' || char === '\n') {
        const submitted = this.current.trim();
        this.lastSafe = isSafePrompt(submitted) ? submitted : null;
        this.current = '';
        continue;
      }
      this.current += char;
    }
  }

  consumeReplayCandidate(): string | null {
    const value = this.lastSafe;
    this.lastSafe = null;
    return value;
  }
}

function isSafePrompt(value: string): boolean {
  return value.length > 0 && value.length <= 2_000 && !value.includes('\n') && !value.startsWith('/');
}
