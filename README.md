# Brightspace MCP Server

> **By [Rohan Muppa](https://github.com/rohanmuppa), ECE @ Purdue**

Talk to your Brightspace courses with AI. Ask about grades, due dates, announcements, and more. Works with Claude, ChatGPT, Cursor, and Windsurf.

This is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that connects your AI to D2L Brightspace so it can pull your grades, assignments, syllabus, and course content on demand.

Works with any school that uses D2L Brightspace, including Purdue, USC, and hundreds more.

<p align="center">
  <img src="https://raw.githubusercontent.com/RohanMuppa/brightspace-mcp-server/main/docs/how-it-works.svg" alt="Architecture diagram" width="100%">
</p>

## Try It

> "Download my lecture slides and turn them into interactive flashcards"
> "Grab every assignment rubric and build me a visual dashboard of what I need to hit for an A"

## Steps to Install

**You need:** [Node.js 18+](https://nodejs.org/) (download the LTS version)

**Purdue students:**
```bash
npx brightspace-mcp-server setup --purdue
```

**Everyone else:**
```bash
npx brightspace-mcp-server setup
```

This command might take a few minutes to download, especially on Windows. Please be patient.

The wizard handles everything: credentials, MFA, and configuring your AI client. When it's done, restart Claude/Cursor and start asking questions.

That's it! You're ready to go.

## Manual Configuration

The setup wizard auto-configures Claude Desktop and Cursor. For other clients, add the server manually:

> **💡 Tip:** Already using Claude Code, Codex, or another AI coding assistant? Just paste this GitHub link and ask it to configure the Brightspace MCP for you: `https://github.com/RohanMuppa/brightspace-mcp-server`

**Claude Code (CLI):**
```bash
claude mcp add brightspace -- npx -y brightspace-mcp-server@latest
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

Mac/Linux:
```json
{
  "mcpServers": {
    "brightspace": {
      "command": "npx",
      "args": ["-y", "brightspace-mcp-server@latest"]
    }
  }
}
```

Windows:
```json
{
  "mcpServers": {
    "brightspace": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "brightspace-mcp-server@latest"]
    }
  }
}
```

**ChatGPT Desktop** (Settings → Tools → Add MCP tool → "Add manually"):

Mac/Linux:
```json
{
  "command": "npx",
  "args": ["-y", "brightspace-mcp-server@latest"]
}
```

Windows:
```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "brightspace-mcp-server@latest"]
}
```

**Cursor** (`~/.cursor/mcp.json`):

Mac/Linux:
```json
{
  "mcpServers": {
    "brightspace": {
      "command": "npx",
      "args": ["-y", "brightspace-mcp-server@latest"]
    }
  }
}
```

Windows:
```json
{
  "mcpServers": {
    "brightspace": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "brightspace-mcp-server@latest"]
    }
  }
}
```

**Windsurf** (`~/.windsurf/mcp.json`):

Mac/Linux:
```json
{
  "mcpServers": {
    "brightspace": {
      "command": "npx",
      "args": ["-y", "brightspace-mcp-server@latest"]
    }
  }
}
```

Windows:
```json
{
  "mcpServers": {
    "brightspace": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "brightspace-mcp-server@latest"]
    }
  }
}
```

After adding, restart your AI client. You still need to run `npx brightspace-mcp-server setup` first to save your credentials.

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

**Browser launch times out (Windows)** → Open Task Manager, end all Chromium/Chrome processes, and try again. If it persists, add the Playwright Chromium folder to your antivirus exclusion list.

**Auth fails in WSL or Docker** → Chromium dependencies may be missing. Run `npx playwright install-deps chromium` to install them. The server automatically adds `--no-sandbox` for these environments.

**Headless login fails (Windows)** → SSO login flows can fail in headless mode on Windows. The default is headed (a browser window opens). If you set `D2L_HEADLESS=true` and auth fails, switch back to headed mode.

## Security

- Credentials stay on your machine at `~/.brightspace-mcp/config.json` (restricted permissions)
- Session tokens are encrypted (AES-256-GCM)
- All traffic to Brightspace is HTTPS
- Nothing is sent anywhere except your school's login page

## Built With

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
![MCP](https://img.shields.io/badge/Model_Context_Protocol-black?logo=anthropic&logoColor=white)
![D2L Brightspace](https://img.shields.io/badge/D2L_Brightspace-003865?logoColor=white)
![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white)

## Updates

Automatic. Every time your AI client starts a session, it runs `npx brightspace-mcp-server@latest` which pulls the newest version from npm. No action needed.

If you ever suspect you're on an old version, run `npm cache clean --force` to clear the cache.

---

Proudly made for Boilermakers by [Rohan Muppa](https://github.com/rohanmuppa) 🚂

[Report a bug](https://github.com/rohanmuppa/brightspace-mcp-server/issues) · AGPL-3.0 · Copyright 2026 Rohan Muppa
