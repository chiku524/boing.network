# Canonical Definition of Malice — QA Pool Reference

> **Purpose:** Single source of truth for what "maliciousness" and "malignancy" mean in Boing's QA system. Pool members and implementers use this as the bar.  
> **References:** [QUALITY-ASSURANCE-NETWORK.md](QUALITY-ASSURANCE-NETWORK.md) §16.3, [QA-PASS-GUIDE.md](QA-PASS-GUIDE.md)

---

## Scope

This document defines **malice** for the purpose of protocol QA: assets that should be **Rejected** (or never Allowed by the pool) because they cause harm or abuse.

---

## Malice Categories

| Category | Definition | Examples |
|----------|------------|----------|
| **Scams** | Deceptive schemes to extract value without fair exchange | Fake tokens, phishing contracts |
| **Phishing** | Impersonation or deceptive UX to steal credentials or funds | Fake wallet interfaces, fake airdrops |
| **Rug-pulls** | Promised functionality that is removed or disabled to trap funds | Liquidity withdrawal, exit scams |
| **Malware** | Code designed to harm user systems or steal data | Keyloggers, backdoors |
| **Impersonation** | Misleading naming or branding to appear as a trusted entity | Fake "official" tokens, copycat projects |
| **Deceptive naming** | Names intended to mislead about purpose or risk | "Safe" in name of risky asset, misleading tickers |
| **Ponzi patterns** | Unsustainable reward structures that rely on new deposits | Pyramid schemes, unsustainable yields |
| **Spam / abuse** | Bulk low-value deployments to clog state or confuse users | Mass empty contracts |

---

## How This Is Enforced

- **Automation:** Blocklist (bytecode hashes), scam patterns (byte sequences), hard rules (size, opcodes)
- **Community pool:** When automation returns Unsure, pool members vote Allow or Reject using this definition
- **Governance:** Can add blocklist entries, scam patterns, or "always review" categories

---

## What Is NOT Malice

- **Meme assets** — Legitimate purpose when declared
- **Experimental or novel** — New patterns that don't match malice categories
- **Unconventional art or culture** — As long as not deceptive or harmful
- **Failed or unpopular projects** — Poor quality ≠ malice

---

## Pool Member Guidance

When voting on an Unsure item:

1. Does it match any malice category above? → **Reject**
2. Is there reasonable doubt it could cause harm? → **Reject**
3. Is it merely unproven or unconventional? → **Allow** (per meme/community leniency)
4. In doubt? → Default to **Reject** (safety-first)

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
