# KnowValue Current Development State

Last updated: 2026

---

# Project Overview

KnowValue is a paid Q&A platform where users can sell real-life knowledge and experience.

Platform concept:

**"Trust becomes currency."**

Users earn rewards through valuable answers and knowledge sharing.

---

# Tech Stack

Frontend / API:
Next.js App Router

Database:
Supabase PostgreSQL

ORM:
Prisma

Authentication:
Supabase Auth

Payments:
Stripe Checkout

Email:
Resend + Supabase Email

Hosting:
Vercel

Domain:
knowvalue.jp

---

# Repository Structure

Root project folder:

my-app

Important directories:

app/
Next.js application routes

app/api/
Server API routes

lib/
Supabase / Prisma / Stripe helpers

prisma/
Database schema and migrations

public/
Static assets

---

# Current Implemented Features

Authentication:

* signup
* login
* email verification
* profile metadata

Questions:

* create question
* categories
* reward amount

Answers:

* post answers
* likes
* comments
* answer images

Notifications:

* notification system
* unread count
* notification page

My Page:

* profile display
* edit profile
* answer history
* question history
* purchase history

Ranking:

API:
app/api/ranking/route.ts

Page:
app/ranking/page.tsx

Ranking shows:

* nickname
* BEST answer count

Local rendering confirmed.

---

# Database State

Prisma schema exists at:

prisma/schema.prisma

Latest migration:

20260304130720_knowvalue_schema

Migration successfully applied.

Database hosted on:

Supabase production project

Important note:

Production database is already connected to this project.

Schema migrations affect production database.

Use caution before running migrations.

---

# Existing API Endpoints

Key endpoints:

/api/questions
/api/answers
/api/best
/api/comments
/api/notifications
/api/ranking
/api/stripe/webhook
/api/user/sync

---

# Current Working Features

* Question posting
* Answer posting
* BEST answer selection
* Notifications
* My Page
* Ranking page
* Stripe payments (question reward escrow)

---

# Partially Implemented

Negotiation system exists in database schema.

Needs UI and payment flow implementation.

---

# Not Yet Implemented

Critical upcoming features:

1. BEST answer content lock
2. Paid viewing of BEST answers
3. Purchase record for BEST answer viewing
4. Trust score system
5. Rank system
6. Report system
7. Boost feature
8. Negotiation UI

---

# Next Development Priority

Highest priority features:

1. BEST answer lock system
2. BEST answer paid viewing
3. Stripe payment for viewing
4. Purchase record creation

Goal:

Enable monetization loop for knowledge resale.

---

# Deployment Flow

Development:

Local Next.js server

Production:

GitHub → Vercel auto deploy

Database:

Supabase production database

---

# Important Constraints

Never break existing:

* authentication
* question posting
* answer posting
* notifications

These features are already working in production.

---

# Current Development Strategy

Design decisions are made collaboratively with ChatGPT ("Mitt").

Implementation will increasingly be assisted by Codex.

Workflow:

Design → Mitt
Implementation → Codex
Review → Mitt

---

# Immediate Next Task

Implement:

BEST answer full lock for non-askers.

Access rules:

* asker → free access
* buyers → paid access
* others → locked content
