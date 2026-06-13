# Security and performance review

Reviewed: 2026-06-12

## Findings

| Risk | Level | Status |
| --- | --- | --- |
| Daily JSON, prompts, internal context, and dictionary metadata were directly downloadable from GitHub Pages. | High | Fixed for future `dist` deployments. Historical Git commits remain public. |
| The public repository contained the same high-resolution PNG set twice, and both paths were live on Pages. | High | Fixed. Originals are ignored; only optimized variants are published. |
| Pages deployed the repository root instead of an explicit allowlist artifact. | High | Fixed in workflow; repository Pages source must be switched to GitHub Actions. |
| Predictable date/id paths and a complete date index made bulk enumeration trivial. | Medium | Replaced by hash-named page chunks and image files. The public manifest remains discoverable by design. |
| Every visit bypassed cache for every historical JSON file. | Medium | Replaced by one short-lived manifest and immutable hash-named chunks. |
| Images lacked responsive variants and explicit intrinsic dimensions. | Medium | Added WebP `srcset`, JPEG fallback, dimensions, lazy loading, and async decoding. |
| Images were overwritten at stable URLs, causing stale browser/CDN caches. | Medium | Content hashes now change whenever an image changes. |
| The old workflow had repository write permission and pushed generated indexes. | Low | Replaced with read-only source access plus Pages/id-token permissions. |
| `.DS_Store` was tracked. | Low | Removed and ignored. |
| API key exposure in tracked files or Git history. | High if present | No real key found. Only `.env.example` placeholder was ever tracked. |

## Public data contract

Only these fields are published:

- `term`
- `pronunciation`
- `definition`
- `fieldNote`
- `sensoryTags`
- `sourceUrl`
- `imageAlt`
- optimized `image` metadata

The build fails if `dist` contains prompt field names, OpenAI key markers, known token formats,
private-key headers, editable artwork formats, or files outside the deployment allowlist.

## Static-site limits

Anything rendered to a visitor can be downloaded, copied, screenshotted, or crawled. Hash file
names reduce guessing and stale caches; they do not provide authorization. `robots.txt` is only a
request to compliant crawlers. Stronger controls require a private origin or authenticated backend,
such as Cloudflare Access, a Worker, or a server-side application.

On a project URL such as `username.github.io/repository/`, the repository-level `robots.txt` is not
the host-root `username.github.io/robots.txt`, so crawler support is not guaranteed. It becomes
effective at the expected root path when the project is served from its own custom domain.

Because the repository is public, deleting source files from the latest branch does not delete them
from Git history. Removing historical prompts and originals requires a coordinated history rewrite
and force-push, or migration to a new clean repository.

## Deployment prerequisite

Before publishing this change, open **Settings → Pages → Build and deployment** and select
**GitHub Actions** as the source. Until that setting is changed, the current branch-based Pages
deployment will continue publishing the repository root rather than the audited `dist` artifact.

## Lighthouse follow-up

After the Actions deployment is live, run PageSpeed Insights for both mobile and desktop. Review:

- LCP: confirm the preloaded hero WebP is the LCP resource and target under 2.5 seconds.
- CLS: confirm explicit image dimensions keep the score under 0.1.
- Image payload: confirm mobile selects the 480px or 768px WebP, not the 1200px/1600px file.
- TBT: target under 200ms; this site has no framework and should remain comfortably below it.
- Cache diagnostics: hash-named images, chunks, CSS, and JS should receive long-lived CDN caching
  once a custom-domain Cloudflare cache rule is enabled.
