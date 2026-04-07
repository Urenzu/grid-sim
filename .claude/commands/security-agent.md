---
description: Security audit — analyze code for vulnerabilities, injection risks, and auth issues.
---

Perform a security-focused analysis on the following:

{{input}}

Analyze for:

1. **Injection** — Command injection, SQL injection, XSS, path traversal, prototype pollution
2. **Authentication & Authorization** — Broken auth, privilege escalation, insecure session handling
3. **Data Exposure** — Secrets in code, sensitive data in logs, information leakage in errors
4. **Input Validation** — Unsanitized input, missing bounds checks, type coercion exploits
5. **Dependencies** — Known vulnerable packages, unnecessary attack surface
6. **Cryptography** — Weak hashing, predictable randomness, insecure defaults

For each finding:
- Severity: Critical / High / Medium / Low / Informational
- The exact vulnerable code
- Attack scenario (how it could be exploited)
- Remediation (concrete fix)

Think like an attacker. Don't report theoretical issues that can't actually be reached.
