---
allowed-tools: Bash(git fetch:*), Bash(git pull:*), Bash(git log:*), Bash(git status:*), Bash(git rev-list:*), Bash(npm install:*), Bash(npm run build:*)
description: Update Purdue Brightspace MCP to the latest version
---

## Context

- Current version: !`node -e "console.log(require('./package.json').version)"`
- Current branch: !`git branch --show-current`
- Git status: !`git status --short`

## Your task

Update the Purdue Brightspace MCP server to the latest version.

Steps:
1. Run `git fetch origin main` to check for updates
2. Run `git rev-list --count HEAD..origin/main` to see how many new commits
3. If there are updates, show what's new with `git log HEAD..origin/main --oneline`
4. Run `git pull origin main` to pull changes
5. Run `npm install` to update dependencies
6. Run `npm run build` to rebuild
7. Show the new version and tell the user to restart their MCP client

If already up to date, just say so. If there are uncommitted changes, warn the user first.
