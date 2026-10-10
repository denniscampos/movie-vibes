---
title: "Discord commands: list and test surfaces to update"
task: discord-mark-watched
date: 2026-10-10
files:
  - app/utils/discord-commands.ts
  - app/routes/api.discord.interactions.ts
  - test/discord-dm.test.ts
tags:
  - discord
---

A new Discord slash command must be appended to commands in app/utils/discord-commands.ts (asserted in test/discord-dm.test.ts), added to isKnownCommand in the interactions route so it gets the allowlist, and named in the register script's header comment. Status changes from Discord use a conditional updateMany on the expected current status, so a concurrent change is never overwritten.
