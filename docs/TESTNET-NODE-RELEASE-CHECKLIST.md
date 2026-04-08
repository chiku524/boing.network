# Testnet `boing-node` zip release checklist (VibeMiner + boing.network)

Use this when shipping a new **`testnet-v0.1.x`** GitHub release so **VibeMiner** default downloads, **`GET /api/networks`**, and D1 listings stay aligned.

## 0. CI must be allowed to publish releases

If **Release binaries** builds all three zips but the **release** job fails with **HTTP 403** when creating the GitHub release, the workflow’s **`GITHUB_TOKEN`** needs **`contents: write`**. This repo sets **`permissions: contents: write`** in [`.github/workflows/release.yml`](../.github/workflows/release.yml). For a one-off recovery, publish the release manually (e.g. `gh release create <tag> release-*.zip`) using artifacts from the failed run.

## 1. Tag and wait for assets

1. Ensure `main` contains the code you want in the zips.
2. Push an annotated tag (example **`testnet-v0.1.8`**):

   ```bash
   git checkout main && git pull
   git tag -a testnet-v0.1.8 -m "Testnet node: describe changes"
   git push origin testnet-v0.1.8
   ```

3. Wait for **Release binaries** (`.github/workflows/release.yml`) to finish. A **git tag alone is not enough** for `releases/download/…` — GitHub must show a **published** release (not draft) with the zip assets attached. Confirm each asset returns **200**:

   - `release-windows-x86_64.zip`
   - `release-linux-x86_64.zip`
   - `release-macos-aarch64.zip`

## 2. Pin SHA256 (Boing repo)

From **`website/`** (or repo root per [TESTNET.md §9](TESTNET.md)):

```bash
node scripts/network-listings-release-sql.mjs testnet-v0.1.8
# optional: --apply to push listing rows if your workflow uses it
```

Paste the three zip hashes into:

- **`website/functions/api/networks.js`** — `BOING_ZIP_SHA` (`windows` / `linux` / `macos`)
- **`packages/shared/src/boing-testnet-node.ts`** in **VibeMiner** — `BOING_TESTNET_ZIP_SHA256_*`

Until these are filled, clients **skip** zip integrity verification (empty or non-64-hex values are ignored).

## 3. D1 / listings

- **boing.network:** apply **`website/migrations/2026-04-08-network-listings-boing-testnet-v0-1-8.sql`** (or regenerate from the script output for your tag) on **`boing-network-db`**.
- **VibeMiner:** apply **`apps/web/d1/migrations/007_boing_testnet_zip_urls_v0_1_8.sql`** on **`vibeminer-db`** so registered listings that still point at **`v0.1.0`–`v0.1.7`** upgrade to the new URLs.

Re-run **`network-listings-release-sql.mjs`** after you change the tag if you need **`node_binary_sha256`** populated in SQL.

## 4. Deploy

- Deploy **boing.network** (Workers / Pages) so **`https://boing.network/api/networks`** exposes the new **`meta.boing_testnet_download_tag`** and merged rows.
- Redeploy **VibeMiner** web/API so static defaults and the Boing overlay match.

## 5. Public RPC (separate)

Updating VibeMiner or listing URLs does **not** upgrade **`https://testnet-rpc.boing.network`**. For opcode / RPC parity with a new `boing-node`, deploy the same build behind that endpoint (see [PUBLIC-RPC-NODE-UPGRADE-CHECKLIST.md](PUBLIC-RPC-NODE-UPGRADE-CHECKLIST.md)).

## 6. Local binary (optional)

To bypass zip download entirely, point VibeMiner at a local **`boing-node`** via **`VIBEMINER_BOING_NODE_EXE`** (see VibeMiner **`docs/NODE_RUNNING.md`**).
