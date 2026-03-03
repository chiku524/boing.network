# Incentivized Testnet — Readiness, Promotion & Mainnet Migration

> **Purpose:** Prepare for, promote, and migrate from an incentivized testnet where validators, developers, and users can earn rewards.  
> **References:** [TESTNET.md](TESTNET.md), [READINESS.md](READINESS.md), [RUNBOOK.md](RUNBOOK.md), [BOING-BLOCKCHAIN-DESIGN-PLAN.md](BOING-BLOCKCHAIN-DESIGN-PLAN.md), [BUILD-ROADMAP.md](BUILD-ROADMAP.md).

---

## Part 1 — Readiness & Launch

### Current Status

VibeMiner shows "no nodes" until bootnodes and public RPC are live. Complete the [Launch-Blocking Checklist](READINESS.md#3-launch-blocking-checklist-critical-path) in [READINESS.md](READINESS.md) before announcing the incentivized testnet.

### Duration: 1 Week vs 1 Month

| Duration | Recommendation |
|----------|----------------|
| **1 week** | Soft launch or rehearsal only |
| **2–4 weeks** | **Recommended** for first incentivized testnet |
| **1 month+** | Consider for Phase 2 after a 2–4 week Phase 1 |

### Technical Readiness Checklist

- [ ] Bootnodes running; multiaddrs in TESTNET.md and website
- [ ] Public RPC live; faucet enabled and tested
- [ ] Genesis and chain ID documented; multi-node sync verified
- [ ] Website testnet/faucet pages show correct RPC and bootnodes

### Incentive Program Design

| Role | Primary incentive | Optional mainnet link |
|------|-------------------|------------------------|
| Validators | Testnet BOING (blocks) + leaderboard/uptime | Small allocation or NFT for top N (capped) |
| Developers | Testnet BOING, bug bounties, dApp recognition | Grant eligibility |
| Users | Faucet + quests/feedback | Optional NFT (capped) |

Document caps and eligibility in a single "Incentivized Testnet Rules" page.

### Pre-Launch Checklist

- [ ] Incentive program documented with criteria and caps
- [ ] **Testnet Portal** live: registration (developer / user / node operator), dashboards; see [TESTNET-PORTAL.md](TESTNET-PORTAL.md). Community quests live under **Users** at `/testnet/users`; see TESTNET-PORTAL.md §10 (Community Quests).
- [ ] Bug bounty scope (if any) defined; contact for submissions
- [ ] Feedback channel live (Discord, GitHub Discussions)
- [ ] Announcement draft with start/end dates and links

### Launch Day

1. Publish bootnode list and public RPC URL
2. Announce start with duration and links
3. Monitor RPC and bootnodes
4. Pin quick start in Discord/Telegram

### Phase 1 Parameters (fill before launch)

| Parameter | Placeholder |
|-----------|-------------|
| Start date | e.g. 2025-03-15 |
| End date | 2–4 weeks recommended |
| Public RPC | https://testnet-rpc.boing.network/ |
| Validator rewards | TBD — define criteria and caps |
| Developer rewards | TBD — per track |
| Bug bounty | GitHub Security Advisories or security@ |

---

## Part 2 — Promotion

### Messaging

- **One-liner:** "Earn testnet BOING and qualify for mainnet BOING. Run a validator, build a dApp, or complete quests — rewards from our Community & Grants pool."

### Channels and Timeline

| When | Action |
|------|--------|
| 2–3 weeks before | Teaser: dates and rules coming soon |
| 1 week before | Publish full rules; pin in Discord/Telegram |
| Launch day | Announce live; link testnet, faucet, rules |
| Mid-phase | Recap stats; optional leaderboard teaser |
| 1 week before end | Reminder to qualify |

### Where to Promote

- Twitter/X, Discord, Telegram, blog, website, VibeMiner/partners. Link to the **Testnet Portal** (`/testnet`) for registration and role-specific dashboards.

---

## Part 3 — Mainnet Migration

### Before Testnet Ends

- Fix end date; state everywhere
- Clarify "mainnet reward" meaning
- Collect validator addresses, bug reports, quest submissions

### After Testnet Ends

- Thank-you post; publish results/leaderboards
- No new promises; stick to published rules

### Mainnet Launch

- "Same chain you tested is now mainnet"
- Publish "Testnet rewards claim" page with eligibility and claim process
- Distribute mainnet BOING from Community & Grants pool per rules

### Tying to Initial Supply

Reserve a defined **Testnet Rewards** slice (e.g. X% of initial supply) from **Community & Grants (15%)** for validators, developers, and users. Publish the cap so all payouts come from this pool.

---

## Appendix A — Reddit Post Draft (Promotion)

Use this draft to promote the incentivized testnet on Reddit. Fill in **[PLACEHOLDERS]** (dates, links) before posting. Check each subreddit's rules and use the right flair.

### Title options (pick one or adapt)

- **Boing Network — Incentivized testnet is live: earn testnet BOING as validator, developer, or user (L1 with protocol-enforced QA)**
- **We're running an incentivized testnet for Boing Network — an L1 where only quality deployments are accepted on-chain. Validators, devs, and users can earn rewards.**
- **Boing Network incentivized testnet: 2–4 weeks to run a validator, build a dApp, or complete quests — rewards from our Community & Grants pool**

### Post body

**Boing Network** is an L1 blockchain built from first principles with one main differentiator: **protocol-enforced quality assurance**. We're the first chain where only deployments that meet defined security and compliance rules are accepted on-chain—reducing scams, congestion, and low-value spam. Think of it as "only quality assets on-chain"; no other major L1 enforces this at the protocol layer.

We're about to launch our **incentivized testnet** and we'd like to invite validators, developers, and users to participate.

**What's in it for you**

- **Validators:** Earn testnet BOING for producing blocks and staying online. Top performers can qualify for mainnet recognition (e.g. allocation or NFT, per our published rules).
- **Developers:** Earn testnet BOING, optional bug bounties, and dApp recognition—plus eligibility for future grants.
- **Users:** Use the faucet, complete quests, and share feedback. Optional rewards (e.g. capped NFT) as defined in our rules.

All rewards come from our **Community & Grants pool**. Full criteria and caps will be on our website and in a single "Incentivized Testnet Rules" page so everything is transparent.

**Timeline**

- **Start:** [e.g. March 15, 2025]
- **End:** [e.g. 2–4 weeks later]
- **Duration:** We're aiming for 2–4 weeks for this first phase.

**How to get started**

1. **Testnet & faucet:** [boing.network/network/testnet](https://boing.network/network/testnet) · [boing.network/network/faucet](https://boing.network/network/faucet)
2. **Docs:** [GitHub — TESTNET.md](https://github.com/chiku524/boing.network/blob/main/docs/TESTNET.md) (bootnodes, RPC, `boing_faucetRequest`)
3. **Run a node:** Build from source (`cargo build --release`) and connect with the published bootnodes, or use **VibeMiner** for a one-click validator setup.
4. **Rules & rewards:** [Link to your "Incentivized Testnet Rules" page when live]

**Tech in short**

- **Stack:** Rust, HotStuff BFT, libp2p, custom VM, Sparse Merkle state.
- **Tooling:** CLI (`boing init`, `boing dev`, `boing deploy`), TypeScript SDK.
- **Tokenomics:** Transparent, sustainable—uncapped supply with floor-triggered waves, no reward cliffs. Fee split ~70–80% validators, ~20–30% treasury.

If you care about scam-resistant DeFi, cleaner mempools, and a chain that enforces quality at the protocol layer, we'd love to have you on testnet. Questions welcome below.

### Links to include (replace if your URLs differ)

- Website: https://boing.network
- Join testnet: https://boing.network/network/testnet
- Faucet: https://boing.network/network/faucet
- GitHub: https://github.com/chiku524/boing.network
- Incentivized testnet doc: https://github.com/chiku524/boing.network/blob/main/docs/INCENTIVIZED-TESTNET.md

### Subreddit tips

| Subreddit | Notes |
|-----------|--------|
| **r/cryptocurrency** | Use flair (e.g. "Project"). Respect 500 karma / 50 comment karma rule; no referral links. |
| **r/ethereum** | Good if you mention L1/DeFi/cross-chain; keep it technical and factual. |
| **r/altcoin** | Allowed but more speculative; focus on "incentivized testnet" and participation, not price. |
| **r/CryptoCurrency** | Similar to r/cryptocurrency; check current rules and flair. |

- **Avoid:** r/CryptoMoonShots and similar unless your community explicitly uses them; can attract the wrong attention.
- **Do:** Post once per subreddit; don't cross-post the same text everywhere the same day.
- **Do:** Answer comments honestly—Reddit rewards engagement and transparency.
- **Do:** Add a short comment right after posting (e.g. "Happy to answer questions about running a node or the QA model") to seed discussion.

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
