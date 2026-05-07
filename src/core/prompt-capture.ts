export class PromptCapture {
  private current = '';
  private lastSafe: string | null = null;
  private escapeMode: 'esc' | 'csi' | 'osc' | null = null;
  private oscSawEscape = false;

  push(data: string): void {
    for (const char of data) {
      if (this.escapeMode) {
        this.advanceEscape(char);
        continue;
      }
      if (char === '\u001b') {
        this.escapeMode = 'esc';
        continue;
      }
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
      if (isIgnorableControl(char)) continue;
      this.current += char;
    }
  }

  consumeReplayCandidate(): string | null {
    const value = this.lastSafe;
    this.lastSafe = null;
    return value;
  }

  private advanceEscape(char: string): void {
    if (this.escapeMode === 'esc') {
      if (char === '[') {
        this.escapeMode = 'csi';
        return;
      }
      if (char === ']') {
        this.escapeMode = 'osc';
        this.oscSawEscape = false;
        return;
      }
      this.escapeMode = null;
      return;
    }

    if (this.escapeMode === 'csi') {
      if (isCsiFinalByte(char)) this.escapeMode = null;
      return;
    }

    if (this.escapeMode === 'osc') {
      if (this.oscSawEscape) {
        this.escapeMode = char === '\\' ? null : 'osc';
        this.oscSawEscape = false;
        return;
      }
      if (char === '\u0007') {
        this.escapeMode = null;
        return;
      }
      if (char === '\u001b') this.oscSawEscape = true;
    }
  }
}

function isSafePrompt(value: string): boolean {
  return value.length > 0 && value.length <= 2_000 && !value.includes('\n') && !value.startsWith('/');
}

function isCsiFinalByte(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x40 && code <= 0x7e;
}

function isIgnorableControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 0x20 || code === 0x7f;
}
