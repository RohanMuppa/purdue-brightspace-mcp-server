# Brightspace MCP Server

> **By [Rohan Muppa](https://github.com/rohanmuppa), ECE @ Purdue**

Talk to your Brightspace courses with AI. Ask about grades, due dates, announcements, and more. Works with Claude, ChatGPT, and Cursor.

Works with any school that uses Brightspace.

<p align="center">
  <img src="https://raw.githubusercontent.com/RohanMuppa/brightspace-mcp-server/main/docs/how-it-works.svg" alt="Architecture diagram" width="100%">
</p>

## Try It

> "Download my lecture slides and turn them into interactive flashcards"
> "Grab every assignment rubric and build me a visual dashboard of what I need to hit for an A"

## Steps To Install and Use

**You need:** [Node.js 18+](https://nodejs.org/) (download the LTS version)

**Purdue students:**
```bash
npx brightspace-mcp-server setup --purdue
```

**Everyone else:**
```bash
npx brightspace-mcp-server setup
```

The wizard handles everything: credentials, MFA, and configuring your AI client. When it's done, restart Claude/ChatGPT/Cursor and start asking questions.

That's it! You're ready to go.

## Session Expired?

Sessions re-authenticate automatically. If auto-reauth fails (e.g., you missed the Duo push):

```bash
npx brightspace-mcp-server auth
```

## What You Can Ask About

| Topic | Examples |
|-------|---------|
| Grades | "Am I passing all my classes?" · "Compare my grades across all courses" |
| Assignments | "What's due in the next 48 hours?" · "Summarize every assignment I haven't turned in yet" |
| Announcements | "Did any professor post something important today?" · "What did my CS prof announce this week?" |
| Course content | "Find the midterm review slides" · "Download every PDF from Module 5" |
| Roster | "Who are the TAs for ECE 264?" · "Get me my instructor's email" |
| Discussions | "What are people saying in the final project thread?" · "Summarize the latest discussion posts" |
| Planning | "Build me a study schedule based on my upcoming due dates" · "Which class needs the most attention right now?" |

## Troubleshooting

**"Not authenticated"** → Run `npx brightspace-mcp-server auth`

**AI client not responding** → Quit and reopen it completely (not just close the window)

**Need to redo setup** → Run `npx brightspace-mcp-server setup` again

**Config location** → `~/.brightspace-mcp/config.json` (you can edit this directly)

## Security

- Credentials stay on your machine at `~/.brightspace-mcp/config.json` (restricted permissions)
- Session tokens are encrypted (AES-256-GCM)
- All traffic to Brightspace is HTTPS
- Nothing is sent anywhere except your school's login page

## Updates

Automatic. Your AI client pulls the latest version every time it starts. No action needed.

---

[Report a bug](https://github.com/rohanmuppa/brightspace-mcp-server/issues) · AGPL-3.0 · Copyright 2026 Rohan Muppa
