# Incentivized Testnet — Promotion & Mainnet Migration

> **Purpose:** How to promote the incentivized testnet and migrate participants to mainnet once the program ends, using the dedicated portion of the initial Boing token supply.  
> **References:** [INCENTIVIZED-TESTNET-READINESS.md](INCENTIVIZED-TESTNET-READINESS.md), [TESTNET.md](TESTNET.md), [BOING-BLOCKCHAIN-DESIGN-PLAN.md](BOING-BLOCKCHAIN-DESIGN-PLAN.md), landing page [Tokenomics](https://boing.network/#tokenomics) (Initial Supply Allocation).

---

## 1. Tying Testnet Incentives to Initial Supply

Your **initial supply allocation** (at mainnet launch) includes:

- **Staking Rewards** — 55%
- **Treasury** — 30%
- **Community & Grants** — 15%

The **dedicated portion for the incentivized testnet** should be explicitly defined as a **sub-allocation of Community & Grants** (or, if you prefer, a small carve-out from Treasury for “testnet → mainnet rewards”). That keeps tokenomics transparent and avoids dilution beyond what you’ve already planned.

**Recommended approach:**

| Pool | Use |
|------|-----|
| **Community & Grants (15%)** | Reserve a defined **Testnet Rewards** slice (e.g. X% of initial supply or Y million BOING) for: mainnet BOING for top validators, bug bounties (mainnet), early builder/dev grants, optional user recognition (e.g. quest completers, feedback). |
| **Transparency** | Publish the cap (e.g. “Up to Z BOING from Community & Grants for testnet program”). All payouts come from this cap so the rest of the 15% remains for ongoing grants and community. |

**Example:** “Testnet incentive program is funded from the Community & Grants allocation. Up to [X]% of initial supply (or [Y] BOING) is reserved for testnet validators, developers, and user recognition. Exact amounts per track are in the Incentivized Testnet Rules.”

This gives you a clear, auditable link: **initial supply → Community & Grants → testnet rewards cap → mainnet distribution.**

---

## 2. Promoting the Incentivized Testnet

### 2.1 Messaging

- **One-liner:** “Earn testnet BOING and qualify for mainnet BOING. Run a validator, build a dApp, or complete quests — rewards from our Community & Grants pool.”
- **Key points:** Time-bound (e.g. 2–4 weeks), clear rules (who gets what), link to faucet + bootnodes + docs. Emphasize “stress-test the network, earn recognition, and be ready for mainnet.”

### 2.2 Channels and Timeline

| When | Action |
|------|--------|
| **2–3 weeks before start** | Teaser: “Incentivized testnet dates and rules coming soon.” Blog + Twitter/X + Discord/Telegram. |
| **1 week before** | Publish full rules: validators, developers, users, bug bounties, caps, end date. Pin in Discord/Telegram; thread on Twitter. |
| **Launch day** | Announce “Incentivized testnet is live.” Link to [testnet](https://boing.network/network/testnet), [faucet](https://boing.network/network/faucet), [INCENTIVIZED-TESTNET-READINESS](INCENTIVIZED-TESTNET-READINESS.md) or a short “Rules” page on the website. |
| **Mid-phase (e.g. week 2)** | Recap: “Week 1 stats — X validators, Y faucet requests, Z dApps.” Optional leaderboard teaser. Keeps momentum. |
| **1 week before end** | Reminder: “One week left to qualify. Check the rules and submit any proofs/registrations.” |

### 2.3 Where to Promote

- **Twitter/X** — Announcements, threads (how to join, validator vs dev vs user), retweet community wins.
- **Discord / Telegram** — Pinned “Start here” (bootnodes, faucet, staking, rules). Dedicated channel for testnet support.
- **Blog / GitHub** — Single “Incentivized Testnet — Rules & Dates” post; link from website and social.
- **Website** — Testnet and faucet pages already exist; add a clear “Incentivized Testnet” banner or section with dates and link to rules.
- **Partners / VibeMiner** — If VibeMiner (or other partners) list Boing, coordinate a short “Run Boing testnet in one click” message and link to your rules.

### 2.4 Engagement Hooks

- **Leaderboard:** “Top validators by blocks produced / uptime” (even if you don’t publish live, announce it will be used for rewards).
- **Quests:** Simple tasks (e.g. “Request from faucet + send one tx”, “Use dApp X”) with a form or wallet proof; rewards from the testnet pool (testnet BOING or eligibility for mainnet recognition).
- **Bug bounties:** Clear scope (e.g. consensus, RPC, security) and rewards (testnet BOING or capped mainnet BOING from Community & Grants); single contact (e.g. security@ or GitHub Security Advisories).

All of this is consistent with [INCENTIVIZED-TESTNET-READINESS.md](INCENTIVIZED-TESTNET-READINESS.md); promotion is about **repeating the same rules and links** everywhere so people know where to go and what to do.

---

## 3. Migrating Users to Mainnet

Goal: **Turn testnet participants into mainnet users** — same wallets, same docs, same mental model — and distribute the promised mainnet BOING from the dedicated supply.

### 3.1 Before Testnet Ends

- **Fix the end date** and state it everywhere (rules, website, announcements).
- **Clarify what “mainnet reward” means:** e.g. “Mainnet BOING from the Community & Grants allocation, distributed after mainnet launch,” with eligibility criteria (top N validators, approved bug reports, completed quests, etc.).
- **Collect what you need for distribution:** validator addresses (from chain or registration), bug report IDs, quest submissions. Store them in a simple, auditable way (e.g. snapshot + CSV or script that reads chain + forms).

### 3.2 Right After Testnet Ends

- **Thank-you post:** “Incentivized testnet is over. Thank you to all validators, developers, and users.”
- **Results:** Publish (or link to) leaderboards, number of participants, and “Rewards will be distributed from the Community & Grants allocation at mainnet launch.”
- **No new promises:** Don’t add new mainnet rewards after the fact; stick to the published rules so the cap stays predictable.

### 3.3 Mainnet Launch Narrative

- **Continuity:** “The same chain you tested is now mainnet. Same RPC-style API, same docs, same wallet format where applicable.”
- **Claim process:** Publish a short “Testnet rewards claim” page: who is eligible, how to claim (e.g. connect wallet, sign, or submit address), and when the claim window opens/closes. All claims from the reserved Community & Grants testnet pool.
- **Validators:** “If you validated on testnet, you can run the same node on mainnet; see RUNBOOK and testnet docs for config changes (e.g. genesis, chain ID).”
- **Developers:** “Deploy to mainnet using the same tooling; switch RPC and chain ID.”

### 3.4 Migration Checklist

| Step | Owner | Done |
|------|--------|------|
| Publish final leaderboard and eligibility list (or hash) | Team | ☐ |
| Define claim mechanism (contract, script, or manual with transparency) | Team | ☐ |
| Publish “Testnet rewards claim” page and claim window dates | Team | ☐ |
| Mainnet launch announcement referencing testnet contributors | Team | ☐ |
| Update website (testnet banner → “Testnet ended; mainnet live”) | Team | ☐ |
| Distribute mainnet BOING from Community & Grants pool per rules | Team | ☐ |
| Post “Distribution complete” summary (amounts per category, not necessarily per address if privacy desired) | Team | ☐ |

---

## 4. Summary

| Phase | Focus |
|-------|--------|
| **Promotion** | Tie incentives to the **dedicated portion of initial supply** (Community & Grants). Use one clear message, 2–4 week timeline, and repeat it on Twitter, Discord, Telegram, blog, and website. Use leaderboards and quests to keep engagement. |
| **Migration** | End testnet on time; publish results and eligibility; at mainnet launch offer **continuity** (same stack, same docs) and a **clear claim process** for mainnet BOING from the testnet pool. |

By defining the testnet reward pool as a **capped part of Community & Grants** (initial supply), you keep tokenomics set and sustainable while giving yourself a clear story: “We reserved X for testnet; we’re distributing it at mainnet to those who qualified.”

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
