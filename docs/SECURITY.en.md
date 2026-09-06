# Security Policy

> [中文版本](../SECURITY.md) | English

## Supported Versions

| Version | Support Status |
|---|---|
| Latest code on `main` branch | ✅ Supported |
| Historical releases | ❌ No security fixes |

> Only the latest code on the `main` branch is supported.

## Reporting a Vulnerability

If you discover a security vulnerability (such as arbitrary file read/write, path traversal, privilege bypass, information leakage, or command injection), please do not disclose it in a public issue.

Report privately through GitHub Security Advisories:

- **GitHub Security Advisories (recommended)**: Create a private report via the repository's Security → Advisories page
- Repository URL: `https://github.com/OWNER/TerminalVoice/security/advisories/new` (replace `OWNER` after creating the repository)

### What to include in your report

Please provide the following to help us locate and fix it quickly:

- Affected version(s) or commit(s)
- A detailed description of the vulnerability and its impact
- Reproduction steps or a PoC (if available)
- A suggested fix (if you have one)

### Response and disclosure

- We will acknowledge receipt within **3 business days**
- Please keep the details confidential until a fix is released (coordinated disclosure)
- After release, we will credit you in the security advisory (please note if you wish to remain anonymous)

## Scope

The following are generally **not considered security vulnerabilities**:

- Issues that require physical access or existing machine privileges to exploit
- Denial of service (DoS) with limited impact
- Known vulnerabilities in third-party dependencies (please upgrade the dependency instead)
