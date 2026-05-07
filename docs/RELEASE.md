# Release Notes and Go-Live Checklist - devin-switcher

**Version:** 1.0.0
**Date:** 2026-05-07
**Status:** Active
**Owner:** itsddvn

---

## 1. Purpose

This document is the release gate for public npm versions of `@itsddvn/dsw`.
When a new version is requested, the maintainer must update the whole codebase,
commit, push, and publish the npm package in that order.

## 2. Required Release Order

1. Update codebase version references.
2. Run verification.
3. Commit the release changes.
4. Push the commit to GitHub.
5. Publish the npm package.
6. Verify the npm registry version.

Publishing before commit and push is not allowed.

## 3. Version Update Scope

Before publishing a new version, update every current project-version reference:

- `package.json` version.
- `package-lock.json` root version and root package version.
- CLI `dsw --version` output in `src/cli/index.ts`.
- Tests that assert version behavior.
- README and product docs that describe the current package version or release identity.
- Release plan and review/report docs that claim package metadata is aligned.

After updates, scan for stale project versions:

```bash
rg -n '0\.4\.0|0\.4\.1|0\.4\.2|0\.4\.3|0\.4\.4|0\.4\.5|@itsddvn/dsw@0\.4\.[0-5]' docs src tests README.md package.json bin -g '!dist'
```

Adjust the scan pattern for the version family being released.
Dependency versions in `package-lock.json` are not project-version drift unless
they refer to the root package metadata.

## 4. Verification Gate

All commands must pass before go-live:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run
```

Also verify:

```bash
node -e "const p=require('./package.json'); const l=require('./package-lock.json'); console.log({package:p.version, lock:l.version, lockRoot:l.packages[''].version})"
npx tsx src/cli/index.ts --version
```

Both version checks must match the target release.

## 5. Commit and Push Gate

Stage only intended release files. Do not stage local artifacts such as images,
temporary tarballs, or unrelated user files.

```bash
git status --short
git diff --cached --stat
git diff --cached | grep -iE '(api[_-]?key|token|password|secret|credential)' || true
git commit -m "chore(release): <version>"
git push origin main
```

If the secret scan returns real credentials, stop and remove them before commit.

## 6. Publish Gate

Publish only after the commit is pushed:

```bash
npm publish
npm view @itsddvn/dsw version
```

If npm requires 2FA, publish with a one-time password or a granular publish
token. Do not commit tokens or write them to tracked files.

## 7. Post-Publish Note

After publish, record:

- Git commit hash.
- npm package version.
- Verification commands run.
- Any npm 2FA/token handling note.

---

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-05-07 | itsddvn | Added mandatory go-live release order and version alignment checklist. |
