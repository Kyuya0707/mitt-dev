# KnowValue Development Rules (AGENTS.md)

## Product Vision

KnowValue is a **"market where trust becomes currency."**

The platform exists to reward real human experience and knowledge.
This is not an ad-driven Q&A platform.

Key principles:

* No advertisements.
* Real human experience is prioritized.
* AI-generated answers are prohibited by policy.
* Trust and credibility must be visible in the system.

---

# Identity & Privacy

User identity verification is required.

However:

* Real names are **never publicly displayed**
* Public display name = **nickname**

Visible information:

* nickname
* trust score
* BEST answer count

Hidden information:

* real name
* email
* payment details

---

# Core Product Rules

### Question reward system

When posting a question:

User sets a reward amount.

Minimum reward:

500 JPY

Reward payment flow:

User → platform escrow → BEST answer selected → payout

Distribution:

* 90% → BEST answerer
* 10% → platform

---

### BEST answer lock

BEST answers are **locked content**.

Only the question asker can see it for free.

Other users must **pay to view the full BEST answer**.

No preview text should reveal meaningful content.

---

### BEST answer resale distribution

When another user purchases access:

Revenue split:

* 50% → original question asker
* 20% → BEST answer author
* 30% → platform

Purchased BEST answers remain **permanently accessible** to the buyer.

---

### Question Boost

Boost can be applied to increase visibility.

Conditions:

* Question reward must be **3000 JPY or more**
* Boost cost = **10% of reward amount**
* Boost can be applied **up to 3 times**

Boost effects:

* Question moves to top of listing
* Increased incentive visibility to answerers

---

### Negotiation System

Answerers can propose higher compensation.

Flow:

1. Answerer proposes a new price
2. Question asker approves or rejects
3. If approved → extra Stripe payment is required
4. Negotiated answerer may post answer

Important rules:

* Other users can still answer
* If negotiated answer loses BEST → no refund

---

# Trust System

Trust score is visible to all users.

Score factors:

Positive:

* BEST answer
* answer likes
* positive engagement

Negative:

* reports
* spam
* rule violations

Trust score updates **daily**.

Rank tiers:

* Bronze
* Silver
* Gold
* Platinum
* Black

Rank affects:

* visibility
* credibility
* ranking page placement

---

# Ranking Page

Ranking shows:

* nickname
* BEST answer count

Ranking periods:

* weekly
* monthly
* all-time

Displayed location:

/ranking

---

# Notification Rules

Optional notifications:

* new answers to user's question
* new questions in user's interest categories
* negotiation proposals

Mandatory notifications:

* 90-day BEST answer reminder

Reminder schedule:

* Day 14
* Day 30
* Day 60
* Day 75

---

# 90-Day Question Rule

If 90 days pass without BEST answer selection:

System checks:

Case A: no answers or extremely low quality
→ full refund to question asker

Case B: normal answers exist
→ system distributes reward among answerers

Platform fee may be applied in case B.

Question becomes **closed**.

---

# Development Rules

When implementing features:

* Prefer small, safe changes
* Never break existing production flows
* Avoid modifying existing database columns unnecessarily

Before editing Prisma schema:

Explain:

* migration impact
* potential data loss
* production risks

Migration steps:

1. npx prisma format
2. npx prisma generate
3. npx prisma migrate dev -n <migration_name>

---

# Technology Stack

Frontend: Next.js App Router
Database: Supabase (PostgreSQL)
ORM: Prisma
Authentication: Supabase Auth
Payments: Stripe
Email: Resend + Supabase
Hosting: Vercel

---

# Development Philosophy

KnowValue prioritizes:

1. Trust
2. Real human experience
3. High-value knowledge
4. Sustainable creator economy

The platform is designed to become:

**A global marketplace where trust becomes currency.**
