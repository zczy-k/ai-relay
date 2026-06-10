# Release Flow

AI Relay uses a fork-friendly release flow.

## Default fork behavior

Fork users can keep deploying from `main`.

- CI runs on pull requests and pushes to `main`.
- Vercel deployments keep using the fork user's Vercel project production branch, which defaults to `main`.
- Cloudflare Pages deployment defaults to `main`.
- No extra branch, Vercel setting, or repository variable is required.

## Upstream maintainer flow

The upstream repository uses `pre-release` as the dogfood branch before publishing to `main`.

```text
feature/* -> pre-release -> maintainer deployment -> main
```

1. Open regular feature and fix pull requests against `pre-release`.
2. Merge reviewed changes into `pre-release`.
3. Deploy and use `pre-release` in the maintainer environment.
4. Open a release pull request from `pre-release` to `main`.
5. Merge to `main` only after validation.

## Vercel maintainer setup

Keep fork users on Vercel's default `main` behavior. For the upstream maintainer environment only, configure the connected Vercel project to deploy production from `pre-release`.

In Vercel:

1. Open the maintainer project.
2. Go to **Settings** -> **Environments**.
3. Under the **Production** environment card, find the **Branch Tracking** settings (or "Production Branch" section).
4. Change the tracked branch from `main` to `pre-release` and click **Save**.

Vercel creates production deployments from the configured production branch, and treats other branches (including `main`) as preview branches.

## Cloudflare maintainer setup

Set these in GitHub under Settings -> Secrets and variables -> Actions -> Variables:

| Variable | Value | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_DEPLOY_BRANCH` | `pre-release` | Deploy the upstream maintainer environment from `pre-release` instead of `main`. |
| `CLOUDFLARE_PAGES_PRODUCTION_BRANCH` | `pre-release` | Create the Pages project with `pre-release` as its production branch. |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `ai-relay` or a private project name | Optional Pages project override for the maintainer environment. |

If these variables are not set, deployment remains compatible with fork users and uses `main`.

> [!IMPORTANT]
> **Existing Cloudflare Pages Project:** If you already have an existing Cloudflare Pages project, Wrangler CLI cannot update its production branch. You must manually go to the Cloudflare Pages Dashboard -> **Settings** -> **Builds & deployments** -> **Production branch**, and switch it to `pre-release` so that your custom production domain tracks the correct branch.

