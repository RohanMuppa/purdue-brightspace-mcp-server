# Project Rules

## When Adding a New Feature

1. Update `README.md` to document the feature
2. Update the architecture SVG at `docs/how-it-works.svg` if the feature changes how the system works
3. Bump the version in `package.json` before publishing

## Commit Format

`{type}: {description}` (e.g., `feat: add course search tool`)

No Co-Authored-By lines. No phase/plan numbers.

## npm Publishing

- `npm publish --otp=CODE` to publish
- README and description on npm are baked in at publish time, so always publish after README changes
- The MCP client config uses `npx brightspace-mcp-server@latest` so users auto-update

## Architecture

- Config store: `~/.brightspace-mcp/config.json` (falls back to `.env`)
- Session tokens: `~/.d2l-session/session.json` (AES-256-GCM encrypted)
- Auth: Playwright-based browser login with Duo MFA support
- Auto-reauth on token expiry via `AuthRunner`
- CLI subcommands: `setup`, `auth`, default (MCP server)
- School presets: `--purdue` flag (extensible via `SCHOOL_PRESETS` in `src/setup.ts`)
