---
title: Run test curation without vitest cache churn
task: discord-mark-watched
date: 2026-10-10
files:
  - vitest.config.ts
tags:
  - curation
  - vitest
---

In this repo every vitest run rewrites node_modules/.vite/vitest/<hash>/results.json, which curate --end treats as an out-of-scope change and so discards the curation. Point vitest's cache outside the worktree (or exclude that path) before relying on curation.
