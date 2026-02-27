# Notion Integration Setup — Quick Manual Checklist

> Use this when filling the [Notion Integrations dashboard](https://www.notion.so/my-integrations) → **New integration**. Copy-paste values as you go.

---

## 1. New Integration — Field-by-field (exact order as in Notion UI)

### Required fields

| Field | Your value | Notes |
|-------|------------|-------|
| **Integration name** * | `________________` | e.g. Cursor Doc Hub |
| **Icon** * | `________________` | 512×512px recommended; URL or upload |
| **Associated workspace** * | `________________` | Select from dropdown |
| **Company name** * | `________________` | Your company or personal name |
| **Website** * | `________________` | e.g. https://yoursite.com |
| **Tagline** * | `________________` | Short description (1–2 sentences) |
| **Privacy Policy URL** * | `________________` | Links in integration page & auth screens |
| **Terms of Use URL** * | `________________` | Links in integration page & auth screens |
| **Email** * | `________________` | Developer contact email |
| **Redirect URIs** * | | OAuth callback URLs (one per line). Path is appended with auth code. Must have protocol. No fragments, relative paths, wildcards, or public IPs. |
| | `________________` | e.g. https://yoursite.com/auth/notion/callback |
| | `________________` | Add more if needed (dev, staging, prod) |

### Optional

| Field | Your value | Notes |
|-------|------------|-------|
| **Notion URL for optional template** | `________________` | Public Notion page URL. If set, users can duplicate this page into their workspace during OAuth. |

---

## 2. Cloudflare Blog Hub (generic, multi-project)

A shared D1/KV/R2 stack exists for all projects. Each project has its own row in `projects` and posts are partitioned by `project_id`.

### Resources

| Resource | Name | ID |
|----------|------|-----|
| D1 | `blog-hub` | `1126a30f-78cd-4a6f-99f2-1615d39aab35` |
| KV (prod) | `BLOG_CACHE` | `0bab091fbfa0467ea4a7e7967fbb326a` |
| KV (preview) | `BLOG_CACHE_preview` | `afa29f390937457dbb84c7607210bd33` |
| R2 | `blog-hub-content` | bucket name |

### D1 schema

- **projects** — `id`, `name`, `slug`, `base_url`, `notion_database_id`
- **posts** — `id`, `project_id`, `notion_page_id`, `slug`, `title`, `status`, `published_at`, `tags`, `canonical_url`, `source_pointer`

Boing Network is seeded: `projects.slug = 'boing-network'`.

### Wrangler config

`infra/blog-hub/wrangler.toml` — use when deploying the blog orchestration Worker.

### Key patterns

- **KV:** `{project_slug}:post:{slug}` → cached HTML
- **R2:** `{project_slug}/posts/{slug}.html` → full content

---

## 3. Post-creation steps (Notion)

- [ ] Copy the **Internal Integration Secret** (or OAuth client ID/secret for public) and store in env/secrets (never commit to git)
- [ ] Create your top-level "Doc Hub" page in Notion
- [ ] Open that page → `⋯` → **Add connections** → select your integration
- [ ] Add the secret to Cursor/MCP config (e.g. `NOTION_API_KEY` or extension settings)

---

## 4. Blog Posts database (Notion schema)

Use this schema if you want Notion as a blog CMS. Create a **database** (full-page or inline) with these properties:

| Property | Type | Notes |
|----------|------|-------|
| **Title** | Title | Default title property |
| **Status** | Select | Options: `Draft`, `Review`, `Published` |
| **Published date** | Date | When the post went live |
| **Slug** | Text | URL-safe identifier (e.g. `my-first-post`) |
| **Tags** | Multi-select | For categorization |
| **Project / Client** | Select or Relation | Link to project if multi-project |
| **Canonical URL** | URL | Optional; final URL where the post lives |
| **Source pointer** | URL | Link back to Cloudflare record, repo, or external ID |

Each blog post = one page in this database.

---

## 5. Notion chatbot follow-up — answers to map implementation

Fill these in so we can map to a concrete implementation (Notion schema, Cursor scripts, Cloudflare config):

1. **Public blog host**
   - [ ] Notion Sites (simpler, Notion-hosted)
   - [ ] Custom site on Cloudflare (more control)

2. **Current Cloudflare storage stack**
   - [ ] D1
   - [ ] KV
   - [ ] R2
   - [ ] All of the above
   - [ ] None / not using yet

3. **Publish trigger**
   - [ ] Manual — you click Publish in Notion
   - [ ] Automated — changing Status to Published triggers a deploy

---

## 6. Your filled values (paste here when ready)

```
Integration name:
Associated workspace:
Company name:
Website:
Tagline:
Privacy policy URL:
Terms of use URL:
Email:
Redirect URIs:
---
Blog host: 
Cloudflare stack:
Publish trigger:
```
