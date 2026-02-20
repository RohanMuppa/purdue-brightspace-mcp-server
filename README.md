# Brightspace MCP Server

> **Created by [Rohan Muppa](https://github.com/rohanmuppa). ECE @ Purdue**

Access your Brightspace (D2L) courses using natural language. Get grades, due dates, announcements, rosters, and more — works with any Brightspace instance. Compatible with any MCP client (Claude Desktop, ChatGPT Desktop, Claude Code, Cursor, etc.).

Originally built for Purdue University's Brightspace, but works with any institution that uses D2L Brightspace as their LMS.

## Architecture

<p align="center">
  <img src="https://raw.githubusercontent.com/RohanMuppa/brightspace-mcp-server/main/docs/how-it-works.svg" alt="Architecture diagram" width="100%">
</p>

## What You Can Do

- "What assignments are due this week?"
- "Show my grades for CS 252"
- "What announcements did my professors post today?"
- "Who is the instructor for MATH 266?"
- "Download the lecture slides from Module 3"
- "What's my grade in all my classes?"
- "Get me the roster emails for my CS course"

## Quick Start

### Prerequisites

**Node.js** (version 18 or higher) — [download here](https://nodejs.org/) (choose LTS).

To check if you have it:
```bash
node --version
```

### Install & Setup (One Command)

```bash
npx brightspace-mcp-server setup
```

The setup wizard will walk you through everything:

1. Enter your Brightspace URL (e.g., `purdue.brightspace.com`)
2. Enter your username and password
3. Configure MFA (Duo push or TOTP)
4. Automatically configure Claude Desktop / Cursor

That's it. Open your MCP client and ask "What are my courses?"

### Purdue Students

```bash
npx brightspace-mcp-server setup
```

When prompted, use `purdue.brightspace.com` as your URL and your Purdue career account credentials. Approve the Duo push when authenticating.

## Updates

Updates are automatic. The `npx brightspace-mcp-server@latest` config in your MCP client always pulls the newest version on launch. No action needed.

To manually update a global install:
```bash
npm install -g brightspace-mcp-server@latest
```

## Available Tools

| Tool | Description |
|------|-------------|
| `check_auth` | Check if you're logged in to Brightspace |
| `get_my_courses` | Get all your enrolled courses |
| `get_upcoming_due_dates` | Get assignments and quizzes due soon |
| `get_my_grades` | Get your grades for one or all courses |
| `get_announcements` | Get course announcements |
| `get_assignments` | Get detailed assignment and quiz information |
| `get_course_content` | Browse course content (modules, files, links) |
| `download_file` | Download course files or submission attachments |
| `get_classlist_emails` | Get email addresses for instructors and TAs |
| `get_roster` | Get course roster (instructors, TAs, optionally students) |
| `get_discussions` | Get course discussion topics and posts |

## Advanced Configuration

### Filter courses

Add course filters via environment variables in your MCP client config:

```json
{
  "mcpServers": {
    "brightspace": {
      "command": "npx",
      "args": ["-y", "brightspace-mcp-server@latest"],
      "env": {
        "D2L_INCLUDE_COURSES": "123456,789012",
        "D2L_EXCLUDE_COURSES": "111111,222222",
        "D2L_ACTIVE_ONLY": "true"
      }
    }
  }
}
```

- `D2L_INCLUDE_COURSES`: Only show these course IDs (comma-separated). Overrides other filters.
- `D2L_EXCLUDE_COURSES`: Hide these course IDs (comma-separated).
- `D2L_ACTIVE_ONLY`: Set to `"false"` to show inactive courses (default: `"true"`).

To find course IDs, ask "What are my courses?" and the tool will show them.

### Re-authenticate

Your session expires after about 1 hour. When it does, the server will attempt auto-reauthentication. If that fails:

```bash
npx brightspace-mcp-server auth
```

You don't need to restart your MCP client after re-authenticating.

## Troubleshooting

**"Not authenticated" error**
- Run `npx brightspace-mcp-server auth` to re-authenticate.

**MCP client doesn't respond to Brightspace queries**
- Restart your MCP client completely (quit and reopen).
- Make sure Node.js 18+ is installed and `npx` is available in your PATH.

**Browser doesn't open during authentication**
- Try running the auth command again. If Chromium wasn't installed, it will be downloaded automatically on first use via the postinstall hook.

**Setup wizard issues**
- Run `npx brightspace-mcp-server setup` again to reconfigure.
- Config is stored at `~/.brightspace-mcp/config.json` — you can edit it directly.

## Security

- Your credentials are stored locally in `~/.brightspace-mcp/config.json` with restricted file permissions (owner-only read/write).
- Session tokens are encrypted using AES-256-GCM and stored in `~/.d2l-session/`.
- Tokens expire after about 1 hour.
- All communication with Brightspace uses HTTPS.
- Credentials are never sent anywhere except your institution's login page.

## Contributing

Found a bug or have a feature request? [Open an issue on GitHub!](https://github.com/rohanmuppa/brightspace-mcp-server/issues)

## License

AGPL-3.0-only — Copyright (c) 2026 Rohan Muppa

## Author

**Rohan Muppa** — ECE @ Purdue University
GitHub: [@rohanmuppa](https://github.com/rohanmuppa)
Project: [brightspace-mcp-server](https://github.com/rohanmuppa/brightspace-mcp-server)
