## Releasing `astrolinkers-sdk`

Steady-state releases publish to npm via **Trusted Publishing**:
the GitHub Actions workflow at `.github/workflows/release.yml`
exchanges an OIDC token for a one-shot upload credential, and the
tarball ships with a SLSA build provenance attestation that links
it back to this exact tag + commit + workflow. No long-lived
`NPM_TOKEN` lives in the repo or CI secrets.

> **One-time exception:** npm does not support pre-registering
> Trusted Publishers for packages that do not yet exist (unlike
> PyPI's pending publishers). The very first publish of
> `astrolinkers-sdk` therefore has to be bootstrapped with a
> short-lived npm Automation Token.

## Bootstrap (only for the first publish)

1. Enable 2FA on the npm account (`Account → Security`).
2. Create a single-use **Automation Token** at
   https://www.npmjs.com/settings/&lt;your-user&gt;/tokens —
   "Automation" so it bypasses 2FA in CI.
3. Add it to the GitHub repo's secrets:
   https://github.com/fedorello/astrolinkers-sdk-ts/settings/secrets/actions
   → "New repository secret" → name `NPM_TOKEN`.
4. Create a `npm` environment in the GitHub repo (Settings →
   Environments → New environment). The workflow targets this
   environment; it does not need any protection rules during
   bootstrap.
5. Cut the first release (see "Cutting a release" below). The
   workflow uploads via the token because no Trusted Publisher is
   configured yet.
6. **Immediately after** the first publish succeeds:
   1. Open
      https://www.npmjs.com/package/astrolinkers-sdk/access →
      "Settings" → "Trusted publishing" → "Add trusted publisher".
   2. Pick **GitHub Actions** and enter the values in the table
      below.
   3. Delete the `NPM_TOKEN` secret from the GitHub repo.

| Field             | Value                 |
| ----------------- | --------------------- |
| Package name      | `astrolinkers-sdk`    |
| GitHub owner      | `fedorello`           |
| Repository name   | `astrolinkers-sdk-ts` |
| Workflow filename | `release.yml`         |
| Environment name  | `npm`                 |

From release 2 onwards the workflow uses OIDC transparently.

## Cutting a release

1. **Bump the version** in `package.json` (the workflow refuses
   to publish if the tag does not match).
2. **Update `CHANGELOG.md`** with the new version's section.
3. **Run the quality gates locally**:

   ```bash
   pnpm install
   pnpm run ci
   pnpm run build
   ```

   Inspect the tarball with `npm pack --dry-run` if you want to
   see exactly what will land on npm.

4. **Commit + push** the version bump:

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Release v0.X.Y"
   git push
   ```

5. **Tag and push the tag**:

   ```bash
   git tag -a v0.X.Y -m "v0.X.Y"
   git push origin v0.X.Y
   ```

   The tag push triggers `release.yml`. Watch the run at
   https://github.com/fedorello/astrolinkers-sdk-ts/actions.

6. **Verify on npm**:

   ```bash
   npm view astrolinkers-sdk version
   ```

   The new version should appear within ~1 minute of the
   workflow completing. `npm install astrolinkers-sdk@0.X.Y`
   should work immediately afterwards. From release 2 onwards
   the npm package page shows a "Provenance" badge.

## What happens on a tag push

```
git push origin v0.X.Y
        │
        ▼
GitHub Actions: release.yml
        │
        ├── Check out the tag
        ├── Install pnpm 11 + Node 22
        ├── Upgrade npm to >= 11.5.1   (required for OIDC)
        ├── pnpm install --frozen-lockfile
        ├── Verify tag == package.json version
        ├── pnpm run ci   (lint + format + typecheck + tests)
        ├── pnpm run build
        ├── Request OIDC token (id-token: write)
        └── npm publish --provenance --access public
                │
                ▼
            npm exchanges OIDC token for upload creds
            (falls back to NODE_AUTH_TOKEN on bootstrap run)
                │
                ▼
            Tarball uploaded with SLSA provenance attestation
```

`npm publish` is used instead of `pnpm publish` because pnpm
does not yet implement the OIDC token exchange (pnpm/pnpm#9812).
Dependency install + build still go through pnpm.

## If something goes wrong

- **Tag-version mismatch** → the workflow exits early before
  publishing. Push a new tag matching `package.json`.
- **`E403 OIDC token exchange failed`** → the Trusted Publisher
  record on https://www.npmjs.com/package/astrolinkers-sdk/access
  does not match the workflow. Confirm GitHub owner / repo /
  workflow filename / environment name are exact matches.
- **`E401 Need auth`** on the very first publish → the
  `NPM_TOKEN` secret is missing or expired. Re-create the token
  and re-add it. (Do not re-create the tag — push `v0.X.(Y+1)`
  with the same version bumped.)
- **A version was published with a bug** → npm does not allow
  re-using a version number. Deprecate the bad version
  (`npm deprecate astrolinkers-sdk@0.X.Y "use 0.X.(Y+1)"`) and
  ship `0.X.(Y+1)`. Unpublish is only allowed within 72 hours
  and only if no other public package depends on the version.

## Why Trusted Publishing instead of a token

- No long-lived credential to leak, rotate, or accidentally
  commit.
- Every upload is tied to a specific tag on a specific repo via
  OIDC + SLSA provenance attestation.
- Compromising a CI secret no longer compromises npm publish
  access — the attacker also needs to push to the repo.
