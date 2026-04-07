# Security policy

## Supported versions

Security updates are applied to the latest release on the default branch (`main`)
and, when applicable, backported to maintained release lines at maintainers’
discretion. Use the latest commit or tagged release for production deployments.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them through one of these channels:

1. **GitHub Security Advisories** (preferred): use
   [Report a vulnerability](https://github.com/Opaismoe/PrimeCache/security/advisories/new)
   for this repository if the feature is enabled for your account.

2. If private advisories are unavailable, contact the repository maintainers
   privately (for example via GitHub profile contact options or organization
   security contact, if published).

Include:

- A short description of the issue and its impact
- Steps to reproduce or a proof of concept, if you can share it safely
- Affected versions or commit range, if known
- Your suggestion for a fix (optional)

## What to expect

- Maintainers will acknowledge receipt as soon as practical.
- We will investigate and may ask follow-up questions.
- We aim to coordinate disclosure after a fix is available; please allow
  reasonable time before public disclosure.

## Scope

Examples of in-scope reports:

- Authentication or authorization flaws in the API or dashboard
- Remote code execution, injection, or unsafe deserialization in the application
- Secrets or credentials exposed in the repository or build artifacts

Out of scope (report to the respective vendor or project instead):

- Denial-of-service against your own deployment without a clear defect in our code
- Issues in third-party services (e.g. Browserless, hosting) unless PrimeCache
  clearly misuses an API in an unsafe way
- Social engineering or physical attacks

## Secure development practices

Contributors should:

- Avoid committing secrets; use environment variables and local `.env` (never committed).
- Keep dependencies updated and review changelogs for security fixes.
- Follow the principle of least privilege for API keys and database access.

Further reading: [GitHub — Adding a security policy to your repository](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository) and [Open Source Guides — Security](https://opensource.guide/#security).
