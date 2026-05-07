const ACCOUNT_NAME_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Validate and normalize an account name. Accepts only letters, digits,
 * underscores, and dashes. Trims whitespace.
 */
export function validateAccountName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Account name is required');
  if (!ACCOUNT_NAME_RE.test(trimmed)) {
    throw new Error('Account name may only contain letters, numbers, underscores, and dashes');
  }
  return trimmed;
}

/**
 * Slugify a free-form string into a valid account name. Returns `null` when
 * the input has no usable characters after slugification.
 */
export function slugifyAccountName(input: string | null | undefined): string | null {
  if (!input) return null;
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}
