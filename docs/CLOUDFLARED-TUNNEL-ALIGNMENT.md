# Align `testnet-rpc.boing.network` with Cloudflare Tunnel (not “custom domain” only)

## Why you see HTTP 405

Adding **`testnet-rpc.boing.network` as a custom domain** on **Cloudflare Pages**, a **Worker**, or a **generic proxied DNS record** does **not** automatically route JSON-RPC **POST** to `boing-node` on your PC. Many of those endpoints only allow **GET** → **405 Method Not Allowed** for `curl -X POST https://testnet-rpc.boing.network/`.

**Boing JSON-RPC requires POST** to `http://127.0.0.1:8545` on the machine running the node. The correct path is:

1. **Cloudflare Tunnel** (`cloudflared`) with a **public hostname** `testnet-rpc.boing.network` → `http://127.0.0.1:8545`
2. **DNS** for `testnet-rpc` owned by that tunnel (CNAME to `*.cfargotunnel.com` as shown in Zero Trust)

## VibeMiner alignment

VibeMiner runs the same command as `boing.network/scripts/start-cloudflare-tunnel.bat`:

```text
cloudflared tunnel --config %USERPROFILE%\.cloudflared\config.yml run boing-testnet-rpc
```

So you need:

| Piece | Value |
|--------|--------|
| Tunnel **name** in Cloudflare / config | `boing-testnet-rpc` (default in VibeMiner **Settings → Public RPC tunnel**) |
| **config.yml** location | `%USERPROFILE%\.cloudflared\config.yml` (or path you set in VibeMiner) |
| **ingress** | `hostname: testnet-rpc.boing.network` → `service: http://127.0.0.1:8545` |

See **[cloudflared-config.example.yml](./cloudflared-config.example.yml)** for a full template.

## Checklist (do in order)

1. **Remove conflicting DNS**  
   Cloudflare → **DNS** → `boing.network` → delete or disable any **testnet-rpc** record that points to Pages, a random IP, or anything other than the tunnel (you will re-add via tunnel UI if needed).

2. **Zero Trust → Tunnels**  
   Create or open tunnel **`boing-testnet-rpc`**. Under **Public hostname**, add:
   - **Subdomain / domain:** `testnet-rpc.boing.network`
   - **Service:** `http://127.0.0.1:8545`  
   Save; let Cloudflare create/update the DNS record for the tunnel.

3. **Local config.yml**  
   After `cloudflared tunnel create boing-testnet-rpc`, ensure `%USERPROFILE%\.cloudflared\config.yml` contains the tunnel UUID, `credentials-file`, and **ingress** with `testnet-rpc.boing.network` → `http://127.0.0.1:8545`. The dashboard often writes this for you; if not, merge from the example file.

4. **Verify locally**  
   ```bash
   node scripts/check-cloudflared-alignment.mjs
   curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" \
     -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"boing_chainHeight\",\"params\":[]}"
   ```

5. **Start tunnel**  
   Boing repo: `scripts\start-cloudflare-tunnel.bat` **or** VibeMiner: start Boing node (with “link tunnel” on) **or** manual **Start** on the tunnel panel.

6. **Verify public**  
   ```bash
   node scripts/verify-public-testnet-rpc.mjs
   ```

## Related

- [INFRASTRUCTURE-SETUP.md](./INFRASTRUCTURE-SETUP.md) — primary + tunnel order of operations.
