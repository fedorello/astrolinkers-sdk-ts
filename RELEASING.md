# Releasing `astrolinkers-sdk`

This SDK is published to npm via **Trusted Publishing** — the
GitHub Actions workflow at `.github/workflows/release.yml`
exchanges an OIDC token for a one-shot upload credential. The
upload also carries a SLSA build provenance attestation that
links the tarball back to this exact tag + commit + workflow.

No long-lived `NPM_TOKEN` lives in the repo or CI secrets.

## One-time setup

These steps are done **once** by the project owner before the
first release. After that, releases are tag-only.

1. Enable 2FA on the npm account (`Account → Security`).

2. **For the very first publish** of `astrolinkers-sdk`, npm
   requires the package to exist before you can register a
   per-package Trusted Publisher. Two ways to get past this
   chicken-and-egg:
   - **Option A — pending publisher (recommended).** On
     https://www.npmjs.com/settings/&lt;your-user&gt;/trusted-publishers
     register a "pending" publisher for the not-yet-published
     package using the values in step 3.
   - **Option B — bootstrap with a token.** Create a single-use
     Automation token at
     https://www.npmjs.com/settings/&lt;your-user&gt;/tokens,
     store it as repo secret `NODE_AUTH_TOKEN`, run the first
     release, then immediately delete the token and register the
     Trusted Publisher on the package's `Access` tab.

3. Register the Trusted Publisher (the workflow already targets
   these exact values):

   | Field             | Value                 |
   | ----------------- | --------------------- |
   | Package name      | `astrolinkers-sdk`    |
   | GitHub owner      | `fedorello`           |
   | Repository name   | `astrolinkers-sdk-ts` |
   | Workflow filename | `release.yml`         |
   | Environment name  | `npm`                 |

4. Create a `npm` environment in the GitHub repo
   (Settings → Environments → New environment). Optional:
   enable "Required reviewers" so a release upload needs a human
   approval.

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

   `pnpm run build` emits `dist/` with the dual ESM + CJS
   entry points and `.d.mts` / `.d.cts` types. Inspect with
   `npm pack --dry-run` to see exactly what will land on npm.

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
   should work immediately afterwards. The provenance badge
   should appear on the package page.

## What happens on a tag push

```
git push origin v0.X.Y
        │
        ▼
GitHub Actions: release.yml
        │
        ├── Check out the tag
        ├── Install pnpm 11 + Node 22
        ├── pnpm install --frozen-lockfile
        ├── Verify tag == package.json version
        ├── pnpm run ci   (lint + format + typecheck + tests)
        ├── pnpm run build
        ├── Request OIDC token (id-token: write)
        └── pnpm publish --provenance --access public
                │
                ▼
            npm exchanges OIDC token for upload creds
                │
                ▼
            Tarball uploaded with SLSA provenance attestation
```

## If something goes wrong

- **Tag-version mismatch** → the workflow exits early before
  publishing. Push a new tag matching `package.json`.
- **npm rejects the upload** → the most common cause is that the
  Trusted Publisher record does not match the workflow. Check
  https://www.npmjs.com/package/astrolinkers-sdk/access and
  confirm the GitHub owner / repo / workflow filename /
  environment name are exact matches.
- **A version was published with a bug** → npm does not allow
  re-using a version number. Deprecate the bad version
  (`npm deprecate astrolinkers-sdk@0.X.Y "use 0.X.(Y+1)"`) and
  ship `0.X.(Y+1)`. Unpublish is only allowed within 72 hours and
  only if no other public package depends on the version.

## Why Trusted Publishing instead of a token

- No long-lived credential to leak, rotate, or accidentally
  commit.
- Every upload is tied to a specific tag on a specific repo via
  OIDC + SLSA provenance attestation.
- Compromising a CI secret no longer compromises npm publish
  access — the attacker also needs to push to the repo.
