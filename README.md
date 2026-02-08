# Purdue Brightspace MCP Server

An MCP server that connects Claude to your Purdue Brightspace account, allowing you to ask natural language questions about your courses, grades, and assignments.

## Features

- **Authenticated Access**: Securely logs in via Purdue SSO (Shibboleth/CAS + Duo 2FA) and manages session tokens.
- **Course Data**: Fetch enrolled courses, grades, assignments, announcements, and content.
- **Natural Language Queries**: Ask questions like "What assignments are due next week?" or "Check my grades for CS 252".

## Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/RohanMuppa/purdue-brightspace-mcp.git
    cd purdue-brightspace-mcp
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    npx playwright install chromium
    ```

3.  **Configure Environment**:
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` with your Purdue credentials (`D2L_USERNAME`, `D2L_PASSWORD`). You can optionally set `MFA_TOTP_SECRET` for automated 2FA, otherwise you will approve Duo pushes manually.

4.  **Build**:
    ```bash
    npm run build
    ```

## Usage

Add the following to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "purdue-brightspace": {
      "command": "node",
      "args": ["/absolute/path/to/purdue-brightspace-mcp/build/index.js"],
      "env": {
        "D2L_USERNAME": "your_username@purdue.edu",
        "D2L_PASSWORD": "your_password"
      }
    }
  }
}
```

Restart Claude and start asking questions!

## License

MIT
