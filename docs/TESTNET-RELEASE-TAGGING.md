# Testnet node release tags (`boing-node` zips)

GitHub Actions builds **`release-{linux-x86_64,macos-aarch64,windows-x86_64}.zip`** when you push a tag matching `testnet*` or `v*` (see `.github/workflows/release.yml`).

## Ship a new testnet binary (e.g. after new JSON-RPC)

1. Ensure `main` has the code you want (e.g. `boing_getQaRegistry`).
2. Create and push an **annotated** tag (example `testnet-v0.1.3`):

   ```bash
   git checkout main
   git pull
   git tag -a testnet-v0.1.3 -m "Testnet node: boing_getQaRegistry and QA transparency RPC"
   git push origin testnet-v0.1.3
   ```

3. Wait for workflow **Release binaries** to finish. It opens a **draft** GitHub Release with the three zips attached.
4. Review release notes, then **publish** the draft (required for public download URLs to work).
5. Refresh Boing website D1 listing SHAs (from `website/`):

   ```bash
   node scripts/network-listings-release-sql.mjs testnet-v0.1.3
   # then apply printed SQL or:
   node scripts/network-listings-release-sql.mjs testnet-v0.1.3 --apply
   ```

6. Bump VibeMiner defaults (`BOING_TESTNET_DEFAULT_DOWNLOAD_TAG`, `networks.ts`) and redeploy if you want new installs to track the tag.
