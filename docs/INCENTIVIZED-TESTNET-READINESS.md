# Boing Network — Incentivized Testnet Readiness & Launch

> **Purpose:** Ensure the network is prepared to launch an **incentivized testnet** where miners/validators, developers, and users can contribute and be rewarded, and to grow the community before mainnet.  
> **References:** [TESTNET.md](TESTNET.md), [BETA-READINESS.md](BETA-READINESS.md), [RUNBOOK.md](RUNBOOK.md), [BOING-BLOCKCHAIN-DESIGN-PLAN.md](BOING-BLOCKCHAIN-DESIGN-PLAN.md) (testnet incentive program), [BUILD-ROADMAP.md](BUILD-ROADMAP.md). **Promotion and mainnet migration:** [INCENTIVIZED-TESTNET-PROMOTION-AND-MIGRATION.md](INCENTIVIZED-TESTNET-PROMOTION-AND-MIGRATION.md).  
> **Launch-blocking path:** For the critical sequence (bootnodes → public RPC → faucet → VibeMiner / boing.observer), see **[LAUNCH-BLOCKING-CHECKLIST.md](LAUNCH-BLOCKING-CHECKLIST.md)**.

---

## Current status (VibeMiner / explorer)

**VibeMiner** shows "no nodes on Boing Network" because there are no published bootnodes or public RPC yet. Until bootnodes and a public faucet RPC are running and configured:

- VibeMiner cannot connect users' nodes to the testnet.
- Terminal validators cannot join the public testnet.
- **boing.observer** cannot display real block/transaction data (it needs the same public RPC URL).

Resolve this by following the steps in **[LAUNCH-BLOCKING-CHECKLIST.md](LAUNCH-BLOCKING-CHECKLIST.md)** before announcing the incentivized testnet.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Duration: 1 Week vs 1 Month](#2-duration-1-week-vs-1-month)
3. [Technical Readiness Checklist](#3-technical-readiness-checklist)
4. [Incentive Program Design](#4-incentive-program-design)
5. [Pre-Launch Checklist](#5-pre-launch-checklist)
6. [Launch Day](#6-launch-day)
7. [Post-Launch & Community](#7-post-launch--community)
8. [Success Metrics](#8-success-metrics)
9. [Phase 1 parameters (fill before launch)](#9-phase-1-parameters-fill-before-launch)

---

## 1. Overview

The **incentivized testnet** is a time-bound phase where:

- **Validators / miners** — Run nodes, produce blocks, keep the network live; earn testnet rewards and/or eligibility for mainnet recognition (e.g. early-validator allocation or NFT).
- **Developers** — Deploy dApps, register for dApp incentives, build tooling; earn testnet BOING, bug bounties, and/or mainnet allocation for shipped projects.
- **Users** — Use the faucet, send transactions, try dApps; participate in quests or feedback and earn testnet BOING or recognition.

**Principles (sustainability-first):**

- Incentives are **non-dilutive** where possible: testnet tokens, NFTs, or a **small, capped** mainnet allocation for testnet contributors.
- Aligns with [BOING-BLOCKCHAIN-DESIGN-PLAN.md](BOING-BLOCKCHAIN-DESIGN-PLAN.md): *"Testnet incentive program: tokens or NFTs for validators, bug hunters, early builders. Non-dilutive (testnet tokens) or small mainnet allocation."*
- Goal: **community growth**, **infra stress-test**, and **developer onboarding** without compromising mainnet tokenomics.

---

## 2. Duration: 1 Week vs 1 Month

| Duration | Pros | Cons | Recommendation |
|----------|------|------|-----------------|
| **1 week** | Fast iteration; quick feedback; lower ops burden. | Short window for devs to ship; limited community growth; validators may not have time to stabilize. | Use for a **soft launch** or **rehearsal** only. |
| **2–4 weeks** | Enough time for validators to join and stabilize, developers to deploy and iterate, and users to try dApps and give feedback. Balances engagement and ops. | Requires sustained support (docs, Discord, faucet). | **Recommended** for the first incentivized testnet. |
| **1 month+** | Maximum reach and depth. | Longer commitment; testnet fatigue if no new activities. | Consider for a **second phase** (e.g. "Incentivized Testnet Phase 2") after a 2–4 week Phase 1. |

**Suggested default:** Run the first incentivized testnet for **2–4 weeks** (e.g. 21 days). Extend by 1–2 weeks if engagement is high and no critical issues, or shorten if a critical bug forces a restart.

---

## 3. Technical Readiness Checklist

Before announcing the incentivized testnet, ensure the following are in place.

### 3.1 Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| **Bootnodes** | ☐ | At least 2 stable bootnodes; multiaddrs published in [TESTNET.md](TESTNET.md) §6 and on [website /network/testnet](https://boing.network/network/testnet). |
| **Public testnet RPC** | ☐ | At least one public RPC URL for submissions and faucet (e.g. `https://testnet-rpc.boing.network/`). Rate limit and monitor abuse. |
| **Faucet** | ☐ | Faucet-enabled node(s) behind the public RPC; [website faucet page](https://boing.network/network/faucet) points to this RPC. Faucet account funded at genesis (10M testnet BOING). |
| **Genesis** | ☐ | Shared genesis for all testnet nodes; document chain ID / name and genesis time if relevant. |
| **Block time / consensus** | ☐ | Stable block production; no known consensus bugs. Run multi-node locally (4+ validators) and confirm sync. |

### 3.2 Software & Docs

| Item | Status | Notes |
|------|--------|-------|
| **Release binaries** | ☐ | Optional but recommended: `boing-node` and `boing` CLI for Windows, Linux, macOS (e.g. GitHub Releases) so users without Rust can join. |
| **TESTNET.md** | ☐ | Bootnode list and public RPC URL filled in; faucet and staking steps clear. |
| **RUNBOOK.md** | ☐ | Node setup, RPC, monitoring; testnet-specific notes if any. |
| **RPC-API-SPEC.md** | ☐ | All testnet-relevant methods documented (`boing_faucetRequest`, etc.). |
| **Website** | ☐ | Testnet and faucet pages show correct RPC URL and bootnodes (set `PUBLIC_TESTNET_RPC_URL` and optionally `PUBLIC_BOOTNODES` in deploy env or `website/.env`; see `website/.env.example`). |

### 3.3 Verification Commands

Run before launch (from [BETA-READINESS.md](BETA-READINESS.md)):

```bash
cargo build --release
cargo test
./target/release/boing --version
./target/release/boing-node --help
```

Smoke test: start a node with `--bootnodes` and `--faucet-enable`, request from faucet, submit a Bond tx.

---

## 4. Incentive Program Design

Define **who** is rewarded and **how** (testnet-only vs small mainnet allocation). Keep it simple for the first phase.

### 4.1 Validators / Miners

| Mechanism | Description | Sustainability |
|-----------|-------------|----------------|
| **Testnet block rewards** | Validators earn testnet BOING for producing blocks (already in place if testnet has block rewards). | Non-dilutive (testnet only). |
| **Uptime / participation** | Track blocks produced, uptime, or successful sync; use for leaderboard or eligibility. | — |
| **Mainnet recognition** | Optional: small mainnet allocation or NFT for top N testnet validators (capped). | Small, one-time; document cap. |
| **VibeMiner** | Users who run via [VibeMiner](VIBEMINER-INTEGRATION.md) count the same as CLI validators if they meet criteria. | — |

**Suggested:** Publish a short "Validator incentives" page or section: e.g. "Top 50 validators by blocks produced get X" or "All validators with >Y% uptime get testnet NFT / eligibility for mainnet drop."

### 4.2 Developers

| Mechanism | Description | Sustainability |
|-----------|-------------|----------------|
| **Testnet BOING** | Use faucet + deploy contracts; register dApps with `boing_registerDappMetrics`; earn testnet BOING from dApp incentive formula on testnet. | Non-dilutive. |
| **Bug bounties** | Critical/high bugs (consensus, RPC, security) rewarded with testnet BOING or small mainnet allocation (define scope and amounts). | Capped; reduces mainnet risk. |
| **Shipped dApp / tooling** | Reward deployed dApps or tools (e.g. dashboard, SDK usage) with testnet BOING or eligibility for mainnet grant. | Builds ecosystem. |
| **Documentation / tutorials** | Optional: reward for quality tutorials or docs that use the testnet. | Community growth. |

**Suggested:** One blog post or doc: "Incentivized Testnet — Developer Tracks" with clear criteria (e.g. "Deploy a contract and register for metrics"; "Report a bug with steps to reproduce").

### 4.3 Users

| Mechanism | Description | Sustainability |
|-----------|-------------|----------------|
| **Faucet usage** | Users get testnet BOING to send txs and try dApps. | Non-dilutive. |
| **Quests / feedback** | Optional: complete tasks (e.g. "Send a tx", "Use dApp X") and submit form or wallet proof for testnet BOING or NFT. | Keeps testnet active. |
| **Community** | Discord/Telegram participation, feedback forms; optional small rewards for helpful feedback. | Low cost; builds community. |

**Suggested:** Keep user incentives light in Phase 1 (faucet + optional 1–2 quests). Scale up in Phase 2 if needed.

### 4.4 Summary Table

| Role | Primary incentive | Optional mainnet link |
|------|-------------------|------------------------|
| Validators | Testnet BOING (blocks) + leaderboard / uptime | Small allocation or NFT for top N (capped) |
| Developers | Testnet BOING, bug bounties, dApp/tooling recognition | Bug bounties in mainnet BOING; grant eligibility |
| Users | Faucet + quests / feedback | Optional NFT or small airdrop (capped) |

Document caps and eligibility in a single "Incentivized Testnet Rules" page or section to avoid ambiguity.

---

## 5. Pre-Launch Checklist

Complete these **before** announcing the start date.

### 5.1 Technical

- [ ] Bootnodes running and stable; multiaddrs in TESTNET.md and website.
- [ ] Public testnet RPC live; faucet enabled and tested.
- [ ] Genesis and chain ID documented; multi-node sync verified (4+ nodes).
- [ ] Release binaries (optional) built and published for major platforms.
- [ ] Website testnet/faucet pages show correct RPC and bootnodes.

### 5.2 Incentives & Rules

- [ ] Incentive program documented (validators, developers, users) with criteria and caps.
- [ ] Bug bounty scope and rewards (if any) defined; contact/channel for submissions.
- [ ] Decision on duration (e.g. 21 days) and end date communicated in the same doc/announcement.

### 5.3 Community & Support

- [ ] Feedback channel live (Discord, GitHub Discussions, or form).
- [ ] Announcement draft (blog, Twitter, etc.) with: start/end dates, how to join, links to testnet + faucet + rules.
- [ ] RUNBOOK and BETA-READINESS reviewed for testnet-specific steps.

### 5.4 Operational

- [ ] Owner/team identified for monitoring (RPC, bootnodes, faucet) and responding to incidents.
- [ ] Decision on chain restart policy (e.g. "We may restart testnet once if critical bug; will announce 24h ahead").

---

## 6. Launch Day

1. **Publish** bootnode list and public RPC URL on website and TESTNET.md.
2. **Announce** start of incentivized testnet with duration, links (testnet, faucet, rules, feedback channel).
3. **Monitor** RPC and bootnodes; fix connectivity issues quickly.
4. **Pin** in Discord/Telegram: quick start (build, bootnodes, faucet, stake) and link to [TESTNET.md](TESTNET.md).

---

## 7. Post-Launch & Community

- **Ongoing:** Monitor feedback channel and GitHub issues; prioritize "can't connect", "faucet not working", "can't stake."
- **Mid-phase:** Optional blog or post: "Incentivized Testnet — Week 1 recap" (metrics, leaderboard teaser, call for more devs/users).
- **Closure:** Announce end date reminder (e.g. 1 week before); after end, publish results (leaderboards, rewards distribution plan) and thank-you post.
- **Distribution:** If mainnet allocation or NFT is promised, document how and when it will be distributed (e.g. at mainnet launch, claim window).

---

## 8. Success Metrics

Use these to judge whether the incentivized testnet was successful and to iterate.

| Metric | Target (example) | Use |
|--------|-------------------|-----|
| **Unique validators** | 20+ nodes with `--validator` joining via bootnodes | Network decentralization and resilience |
| **Faucet requests** | 100+ unique accounts | User and dev onboarding |
| **Deployed contracts / dApp registrations** | 5+ | Developer engagement |
| **Bug reports** | Any; critical/high fixed before mainnet | Security and stability |
| **Community size** | Discord/Telegram growth; qualitative feedback | Long-term community growth |
| **Uptime** | Bootnodes and RPC >99% during the phase | Operational readiness |

Adjust targets to your capacity; the main goal is **community growth** and **readiness for mainnet**, not maximum numbers in the first run.

---

## Summary

- **Duration:** Prefer **2–4 weeks** (e.g. 21 days) for the first incentivized testnet; 1 week is tight for community growth.
- **Readiness:** Bootnodes, public RPC, faucet, genesis, and docs must be in place before launch; use the checklists in §3 and §5.
- **Incentives:** Validators (testnet BOING + optional mainnet recognition), developers (testnet BOING, bug bounties, dApp recognition), users (faucet + optional quests). Keep mainnet allocation **small and capped** (sustainability-first).
- **Launch:** Publish bootnodes and RPC, announce with clear rules and duration, monitor and support; close with results and distribution plan.

Once the items in §3 and §5 are complete, you are **ready to launch** the incentivized testnet. This document can be updated with actual bootnodes, RPC URL, and program rules when you set the final launch date.

---

## 9. Phase 1 parameters (fill before launch)

Fill in the table below (and any linked pages) before announcing the incentivized testnet. This gives you a single place to set dates and reward criteria.

| Parameter | Example / placeholder | Your value |
|-----------|------------------------|------------|
| **Start date** | e.g. 2025-03-15 | TBD — set before announce |
| **End date** | e.g. 2025-04-05 (21 days) | TBD — recommend 2–4 weeks |
| **Public RPC URL** | https://testnet-rpc.boing.network/ | `https://testnet-rpc.boing.network/` (Cloudflare tunnel) |
| **Validator rewards** | e.g. "Top 50 by blocks produced: testnet NFT + mainnet eligibility; all with >90% uptime: testnet BOING" | TBD — define criteria and caps |
| **Developer rewards** | e.g. "Deploy + register dApp: 5k testnet BOING; bug bounty: critical 50k testnet BOING" | TBD — define per track |
| **User rewards** | e.g. "Faucet + 1 quest (submit tx proof): testnet BOING" | TBD — faucet built-in; optional quests |
| **Bug bounty scope** | GitHub Security Advisories or security@; critical/high only | GitHub Security Advisories or security@boing.network |
| **Feedback channel** | Discord / GitHub Discussions / form link | TBD — set before launch |

After filling, update the website config (`website/src/config/testnet.ts` or env `PUBLIC_TESTNET_RPC_URL`, `PUBLIC_BOOTNODES`), [TESTNET.md](TESTNET.md) §6 bootnode table, and this table; then proceed to §6 Launch day. For **promoting** the testnet and **migrating** participants to mainnet (using the dedicated initial-supply portion), see [INCENTIVIZED-TESTNET-PROMOTION-AND-MIGRATION.md](INCENTIVIZED-TESTNET-PROMOTION-AND-MIGRATION.md).

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
