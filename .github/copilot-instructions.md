# Copilot Agent Instructions

> Read this file at the start of every task. All items listed here are non-negotiable unless explicitly overridden in the task prompt.

---

## 🧠 General Principles

- Prioritize **clean, maintainable, and performant** code. Choose the most efficient and scalable solution while keeping readability high.
- Avoid **unnecessary refactoring** outside the scope of the task. Stay focused.
- Do **not** introduce new dependencies unless clearly justified and discussed.
- Prefer **explicit over implicit** — avoid magic values, unclear abbreviations, or overly clever code.
- Use **TypeScript strictly**: avoid `any`, prefer narrowed types, and leverage type inference where appropriate.

---

## 🧪 Testing

- Add or update tests to **fully cover your changes** when necessary.
- Remove or refactor **outdated tests** if they are no longer valid after your changes.
- Do **not** leave skipped (`it.skip`, `xit`) or commented-out tests without explanation.
- Tests should be meaningful — avoid testing implementation details; prefer testing behavior.
- This project uses **Jest** — write unit tests for services/utilities and e2e tests for controllers/routes.

---

## 📄 Documentation

- Update `README.md` files **only if the changes meaningfully affect** usage, setup, configuration, or developer experience.
- Avoid unnecessary expansion of documentation — keep it concise and accurate.
- Do **not** add inline comments for self-evident code. Comment only when the *why* is non-obvious.

---

## 🔒 Security

- **Never hardcode secrets**, API keys, tokens, or credentials. Use environment variables.
- Validate and sanitize **all incoming request data** — use NestJS `ValidationPipe` and class-validator DTOs.
- Follow the **principle of least privilege** — only expose what is necessary via API.
- Be mindful of **information leakage** in error responses — do not expose stack traces or internal details in production.
- Keep dependencies **up to date** and flag any known vulnerabilities when encountered.
- Apply **authentication and authorization guards** appropriately — do not leave endpoints unprotected unintentionally.

---

## ⚡ Performance

- Avoid **N+1 query patterns** — use Prisma `include`/`select` efficiently and batch queries where possible.
- Do **not** load unnecessary relations — select only the fields required for the response.
- Use **pagination** for list endpoints — never return unbounded arrays.
- Avoid blocking the event loop with heavy synchronous computation.

---

## 🗂️ Code Structure & Conventions

- Follow the **existing file and folder structure** and NestJS module conventions. Do not reorganize without explicit instruction.
- Each feature should have its own **module, controller, service, and DTO** files following NestJS patterns.
- Place **shared logic** in appropriate shared modules or utilities rather than duplicating it.
- Use **Prisma** for all database access — do not introduce raw SQL unless absolutely necessary.
- Keep **DTOs explicit** — define separate request/response DTOs and use `class-transformer` where appropriate.
- Run `prisma generate` after any schema changes and include migration files in the commit.

---

## 🔁 Scope Discipline

- Stick to the **task at hand**. Do not fix unrelated issues or improve unrelated code unless directly asked.
- If you notice something outside scope that warrants attention, **mention it as a comment** rather than silently changing it.
- Prefer **small, focused commits** — do not bundle unrelated changes.