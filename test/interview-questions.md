# Mini ERP — Interview Questions & Answers

> 65 questions covering the full project, ordered by priority (High → Medium → Low).
> Based on the actual implementation: React 19 + Vite, Express 5, TypeScript, PostgreSQL, Prisma, JWT, Tailwind CSS.

---

## 🔴 HIGH PRIORITY — Core Architecture & Design Decisions

---

**Q1. Walk me through the overall architecture of this project.**

This is a full-stack monorepo with two separate apps — a React + Vite frontend (`/client`) and an Express + TypeScript REST API (`/server`). They communicate over HTTP. The frontend uses Axios with `withCredentials: true` so the JWT cookie is sent on every request. The backend uses Prisma as the ORM to talk to PostgreSQL. There is no shared code between client and server — they are completely decoupled.

---

**Q2. Why did you choose JWT stored in an httpOnly cookie instead of localStorage?**

Storing JWT in localStorage exposes it to XSS attacks — any injected script can read it. An httpOnly cookie cannot be accessed by JavaScript at all, so even if XSS occurs the token is safe. The cookie is also set with `SameSite: lax` in development and `SameSite: none; Secure` in production to prevent CSRF while still working cross-origin.

---

**Q3. Explain the request status workflow — DRAFT → SUBMITTED → APPROVED/REJECTED.**

Every purchase request starts as `DRAFT` when created. The owner (employee) can submit it, which moves it to `SUBMITTED`. A Manager or Admin then reviews it and either approves (→ `APPROVED`) or rejects (→ `REJECTED`). Every transition writes an immutable `AuditLog` record with the old status, new status, who performed the action, and optional remarks. This gives a full audit trail.

---

**Q4. How does role-based access control work in this system?**

There are three roles: `EMPLOYEE`, `MANAGER`, `ADMIN`. On the backend, a `requireRole` middleware checks the role on the authenticated JWT payload before allowing access to protected routes. For example, `/requests/:id/approve` only allows `MANAGER` or `ADMIN`. On the frontend, the `ProtectedRoute` component accepts an optional `roles` prop — if the logged-in user's role is not in that array, they are redirected. The Sidebar also conditionally hides the "Approval Management" link for employees.

---

**Q5. How does authentication work end-to-end?**

1. User submits the login form with email, password, and role.
2. Backend validates the Zod schema, finds the user by email, compares the password hash with bcrypt, and checks the role matches the stored role.
3. If valid, a JWT is signed with the user's id, email, and role, then set as an httpOnly cookie.
4. On every subsequent request, the browser sends the cookie automatically.
5. The `authenticate` middleware verifies the JWT and attaches the user to `req.authenticatedUser`.
6. On app load, `AuthContext` calls `GET /auth/me` to restore the session from the cookie.

---

**Q6. Why does the Axios interceptor skip the redirect for `/auth/me`?**

This was a real bug I debugged. `AuthContext` calls `/auth/me` on every page load to restore the session. If the user is not logged in, the backend returns `401`. Without the guard, the interceptor would redirect to `/login`, which reloads the app, which calls `/auth/me` again — an infinite redirect loop. The fix is to check `url.includes('/auth/me')` and skip the redirect for that specific call. `AuthContext` handles the failure silently by setting `user` to `null`.

---

**Q7. How does the Prisma schema model the audit trail?**

There is a separate `AuditLog` model with fields: `action` (enum: CREATED, SUBMITTED, APPROVED, REJECTED), `oldStatus`, `newStatus`, `remarks`, `requestId` (FK to PurchaseRequest), `performedById` (FK to User), and `createdAt`. It has no `updatedAt` because audit logs are immutable — they are never updated after creation. Every status transition in the controller creates a new `AuditLog` row.

---

**Q8. How does data scoping work for different roles?**

Employees only see their own data. Managers and Admins see everything. This is enforced on the backend — the `GET /requests` handler checks the user's role and adds a `WHERE createdById = userId` clause for employees. The same scoping applies to dashboard stats and activity. The frontend never controls what data is returned — it always trusts the backend to scope correctly.

---

**Q9. Why did you use Zod for validation instead of express-validator or Joi?**

Zod integrates naturally with TypeScript — it infers types from schemas, so you get both runtime validation and compile-time type safety from a single source of truth. `registerSchema.parse(req.body)` throws a `ZodError` if validation fails, which the global error handler catches and formats into a `400` response. No need to write separate TypeScript interfaces for request bodies.

---

**Q10. Explain the `useRequests` custom hook.**

`useRequests` encapsulates all the state and logic for fetching paginated, filtered purchase requests. It holds `requests`, `meta` (total, totalPages, page), `loading`, `error`, and `params`. It uses `useCallback` to memoize the fetch function so it only re-runs when `params` changes. `useEffect` calls `fetch` whenever `params` updates. The hook exposes `setParams` so pages can update filters/pagination without managing fetch logic themselves. Both `RequestsPage` and `ApprovalPage` use this hook.

---

---

## 🔴 HIGH PRIORITY — Backend Deep Dive

---

**Q11. How does the `authenticate` middleware work?**

It reads the JWT from the `token` cookie (or the `Authorization: Bearer` header as a fallback). It verifies the token using `jsonwebtoken.verify()` with the `JWT_SECRET`. If valid, it decodes the payload and fetches the full user from the database to ensure the user still exists and hasn't been deleted. It attaches the user to `req.authenticatedUser`. If the token is missing or invalid, it throws an `UnauthorizedError` which the global error handler converts to a `401` response.

---

**Q12. How does the email domain restriction work?**

The `ALLOWED_EMAIL_DOMAIN` environment variable (default `@k95foods.com`) is checked in the auth service during both registration and Google OAuth. If the email does not end with the allowed domain, the service throws a `ForbiddenError` which becomes a `403` response. This prevents people outside the company from creating accounts.

---

**Q13. How does the role validation at login work and why?**

At login, the user submits their email, password, AND their role. The backend fetches the user by email, verifies the password, then checks `user.role === submittedRole`. If they don't match, it throws a `ForbiddenError` (403). This is a deliberate design choice — it prevents an employee from logging in as a manager by just knowing the password. The role acts as a second factor of identity.

---

**Q14. How is the CSV export implemented?**

The `GET /requests/export` endpoint uses the same filter logic as the list endpoint but ignores pagination (fetches all matching records). It uses the `json2csv` library to convert the array of request objects into CSV format. The response sets `Content-Type: text/csv` and `Content-Disposition: attachment; filename="purchase_requests.csv"` headers so the browser triggers a file download. On the frontend, `getExportUrl()` builds the URL with current filter params and opens it in a new tab.

---

**Q15. How does the global error handler work?**

There is a centralized `error.middleware.ts` that is registered as the last middleware in Express. It catches all errors passed via `next(error)`. It checks the error type — `ZodError` becomes `400`, `AppError` subclasses use their own status code, and anything else becomes `500`. It always returns a consistent JSON shape: `{ success: false, message: "..." }`. This means controllers never need their own try/catch for response formatting — they just call `next(error)`.

---

**Q16. Why did you use Prisma over writing raw SQL?**

Prisma provides type-safe database queries — the generated client knows the exact shape of every model, so TypeScript catches mistakes at compile time. Migrations are version-controlled and reproducible. The schema is the single source of truth for both the database structure and the TypeScript types. For a project of this size, the productivity gain is significant compared to writing and maintaining raw SQL.

---

**Q17. What is the Prisma singleton pattern and why is it used?**

In `src/lib/prisma.ts`, a single `PrismaClient` instance is created and exported. In development, hot-reloading (nodemon) would create a new `PrismaClient` on every file change, exhausting the database connection pool. The singleton pattern stores the instance on the `global` object in development so it is reused across hot reloads. In production, a single module-level instance is sufficient.

---

**Q18. How does Winston logging work in this project?**

Winston is configured with two transports: console output for development and `daily-rotate-file` for production. The daily rotate transport creates a new log file each day (e.g., `2026-05-23-app.log`) and automatically deletes old files after a configured retention period. A correlation ID middleware generates a unique ID per request and attaches it to every log entry, making it easy to trace all log lines for a single request.

---

**Q19. How does Google OAuth work alongside email/password auth?**

Passport.js with the `passport-google-oauth20` strategy handles the OAuth flow. When the user clicks "Continue with Google", the browser is redirected to `GET /auth/google`, which redirects to Google's consent screen. After consent, Google redirects back to `/auth/google/callback`. Passport calls the verify callback, which uses `findOrCreateUser` — it looks up the user by email, creates them if they don't exist (with `password: null`), and checks the domain restriction. Then a JWT cookie is set and the user is redirected to the frontend.

---

**Q20. What HTTP status codes does your API use and when?**

- `200` — successful GET, PATCH, POST (login/logout)
- `201` — successful resource creation (register, create request)
- `400` — validation error (Zod schema failure)
- `401` — missing/invalid token or wrong credentials
- `403` — wrong email domain or role mismatch
- `404` — resource not found
- `409` — email already registered (duplicate)
- `500` — unexpected server error

---

---

## 🔴 HIGH PRIORITY — Frontend Deep Dive

---

**Q21. How does `AuthContext` work and why is it needed?**

`AuthContext` is a React context that holds the global authentication state: `user`, `setUser`, and `loading`. It wraps the entire app in `main.jsx`. On mount, it calls `GET /auth/me` to restore the session from the cookie. While that call is in-flight, `loading` is `true` — `ProtectedRoute` waits for loading to finish before deciding to redirect or render. Without this context, every component would need to independently fetch the current user.

---

**Q22. How does `ProtectedRoute` work?**

`ProtectedRoute` reads `user` and `loading` from `AuthContext`. While loading, it renders a spinner. If loading is done and `user` is null, it redirects to `/login`. If a `roles` prop is provided, it also checks `user.role` against the allowed roles — if the role doesn't match, it redirects to `/dashboard`. This is used for the `/approvals` route which only allows `MANAGER` and `ADMIN`.

---

**Q23. How is routing structured in `App.jsx`?**

React Router v7 is used. The `/login` route is public. All other routes are nested inside a `ProtectedRoute` that renders `AppLayout` (the sidebar + navbar shell) as the layout. The `<Outlet />` in `AppLayout` renders the matched child route. The `/approvals` route has a second nested `ProtectedRoute` with a `roles` check. The root `/` redirects to `/dashboard` with `<Navigate replace />`.

---

**Q24. How does the `ConfirmationModal` component work?**

It is a controlled modal — `isOpen` prop controls visibility. It has local state for `remarks` (the optional comment textarea). When the user clicks Confirm, it calls `onConfirm(remarks)` passing the remarks up to the parent. The parent (`ApprovalPage`) then calls the API. The modal resets its `remarks` state on both confirm and close. The `confirmVariant` prop switches the button between indigo (approve) and red (reject).

---

**Q25. How does the filter and search system work?**

`useRequests` holds a `params` object (status, priority, department, from, to, page, limit). `FilterBar` renders dropdowns for status, priority, and date range. `SearchBar` renders a text input for department. When any filter changes, the component calls `setParams` from the hook, which triggers a re-fetch via `useEffect`. `buildQueryString` in utils converts the params object to a URL query string, skipping empty/null values.

---

**Q26. Why did you use React Hook Form instead of controlled inputs?**

React Hook Form uses uncontrolled inputs with refs, which means the component does not re-render on every keystroke — only on validation events. For a form with 7 fields, this is a meaningful performance improvement. It also provides a clean API for validation rules, error messages, and form submission state (`isSubmitting`). The `register` function connects each input to the form without boilerplate `onChange` handlers.

---

**Q27. How does pagination work?**

The backend returns `{ requests, total, page, limit, totalPages }`. The `useRequests` hook stores `meta.totalPages` and `meta.page`. The `Pagination` component renders page buttons based on `totalPages` and calls `onPageChange` when clicked. The page calls `setParams(prev => ({ ...prev, page: p }))` which updates the params and triggers a re-fetch. The `Pagination` component hides itself when `totalPages <= 1`.

---

**Q28. How does the Axios instance handle authentication?**

The Axios instance in `api/axios.js` is created with `baseURL` pointing to the backend and `withCredentials: true`. The `withCredentials` flag tells the browser to include cookies (including the httpOnly JWT cookie) on every cross-origin request. There is no need to manually attach an `Authorization` header — the cookie is sent automatically by the browser.

---

**Q29. How are environment variables handled in Vite vs Node?**

In Vite (frontend), environment variables must be prefixed with `VITE_` to be exposed to client-side code. They are accessed via `import.meta.env.VITE_API_URL`. In Node (backend), variables are loaded from `.env` via `dotenv` and accessed via `process.env.DATABASE_URL`. The `.env` files are gitignored — `.env.example` files are committed as templates.

---

**Q30. How does the `timeAgo` utility function work?**

It calculates the difference between `Date.now()` and the parsed date in milliseconds. It converts to minutes, then hours, then days, returning a human-readable string like "5m ago", "2h ago", or "3d ago". If the difference is less than 1 minute, it returns "just now". This is used in the `ActivityTimeline` component on the dashboard.

---

---

## 🟡 MEDIUM PRIORITY — Database & Prisma

---

**Q31. Walk me through the Prisma schema — what models exist and how are they related?**

Three models: `User`, `PurchaseRequest`, and `AuditLog`. A `User` has many `PurchaseRequest` records (requests they created) and many `AuditLog` records (actions they performed). A `PurchaseRequest` belongs to one `User` (creator) and has many `AuditLog` records. An `AuditLog` belongs to one `PurchaseRequest` and one `User` (performer). There are also four enums: `Role`, `Priority`, `Status`, and `AuditAction`.

---

**Q32. Why is the `password` field nullable on the User model?**

Google OAuth users don't have a password — they authenticate via Google's token. When `findOrCreateUser` creates a Google OAuth user, `password` is set to `null`. Email/password users always have a hashed password. The auth service checks `if (!user.password)` before attempting `bcrypt.compare` to avoid errors for OAuth-only accounts.

---

**Q33. How do Prisma migrations work and how did you use them?**

`prisma migrate dev` generates a SQL migration file based on the diff between the current schema and the database, applies it, and regenerates the Prisma client. Migration files are committed to version control so the database history is reproducible. There are three migrations in this project: creating the users table, creating the purchase_requests table, and adding the password field to users (added later when email/password auth was introduced).

---

**Q34. What does the seed script do and how do you run it?**

The seed script creates 3 test users (employee, manager, admin) using `upsert` so it is idempotent — running it twice won't create duplicates. It then creates 11 purchase requests across all statuses (DRAFT, SUBMITTED, APPROVED, REJECTED) with realistic data. For each request, it also creates the corresponding audit log entries. Run with `npm run prisma:seed` which calls `npx ts-node src/prisma/seed.ts`.

---

**Q35. Why use `upsert` in the seed script instead of `create`?**

`create` would throw a unique constraint error if the email already exists (e.g., running the seed a second time). `upsert` with `where: { email }` and `update: {}` means "create if not exists, do nothing if exists". This makes the seed script safe to run multiple times without errors.

---

**Q36. How does Prisma handle the `@map` and `@@map` directives?**

`@map("column_name")` maps a Prisma field name to a different database column name. For example, `createdAt @map("created_at")` means the TypeScript field is `createdAt` (camelCase) but the database column is `created_at` (snake_case). `@@map("table_name")` maps the model name to a different table name — `@@map("purchase_requests")` means the table is `purchase_requests` but the Prisma model is `PurchaseRequest`.

---

**Q37. What is the `directUrl` in the Prisma datasource and when is it needed?**

`directUrl` is used when the primary `DATABASE_URL` goes through a connection pooler (like PgBouncer or Supabase's pooler). Prisma migrations and introspection need a direct connection to the database, not a pooled one. `directUrl` provides that direct connection string. For local development with a direct PostgreSQL connection, both URLs are the same.

---

## 🟡 MEDIUM PRIORITY — Security

---

**Q38. What security measures are implemented in this project?**

- Passwords hashed with bcrypt (10 salt rounds) — never stored in plain text
- JWT in httpOnly cookie — not accessible to JavaScript
- `SameSite: lax` cookie attribute — prevents CSRF in most scenarios
- `Secure: true` in production — cookie only sent over HTTPS
- Email domain restriction — only company emails can register
- Role validation at login — prevents privilege escalation
- Zod input validation — prevents malformed data from reaching the database
- CORS configured to only allow the frontend origin

---

**Q39. How does bcrypt password hashing work?**

`bcrypt.hash(password, 10)` generates a salt and hashes the password with 10 rounds of the bcrypt algorithm. The salt is embedded in the resulting hash string, so you don't need to store it separately. `bcrypt.compare(plaintext, hash)` re-hashes the plaintext with the embedded salt and compares. The 10 rounds means 2^10 = 1024 iterations, making brute-force attacks slow.

---

**Q40. What is CORS and how is it configured here?**

CORS (Cross-Origin Resource Sharing) is a browser security mechanism that blocks requests from a different origin unless the server explicitly allows it. The Express server uses the `cors` middleware configured with `origin: process.env.FRONTEND_URL` (the React app's URL) and `credentials: true` (required for cookies to work cross-origin). Without `credentials: true`, the browser would not send the cookie even if `withCredentials: true` is set on Axios.

---

**Q41. What are the known security limitations of this project?**

- No email verification — any valid-domain email can register without confirming ownership
- Role is self-selected at registration — no admin approval of role assignments
- No rate limiting on auth endpoints — vulnerable to brute-force attacks
- No password reset flow
- No refresh token mechanism — the JWT is valid for 7 days with no way to invalidate it server-side (no token blacklist)

---

## 🟡 MEDIUM PRIORITY — React Patterns & Performance

---

**Q42. Why is `useCallback` used in `useRequests`?**

The `fetch` function is defined inside the hook. Without `useCallback`, a new function reference is created on every render. Since `fetch` is in the `useEffect` dependency array, this would cause an infinite loop — every render creates a new `fetch`, which triggers the effect, which fetches data, which updates state, which re-renders. `useCallback` with `[params]` as dependencies ensures `fetch` only gets a new reference when `params` actually changes.

---

**Q43. How does the `StatusBadge` component work?**

It takes a `status` prop and looks up the corresponding CSS classes from the `STATUS_COLORS` constant object (`DRAFT: 'bg-gray-100 text-gray-600'`, etc.). It renders a `<span>` with those classes. This pattern centralizes the color mapping in `constants/index.js` so changing a color only requires one edit. `PriorityBadge` works the same way with `PRIORITY_COLORS`.

---

**Q44. How does the `AppLayout` component work with React Router?**

`AppLayout` renders the `Sidebar` and `Navbar` as persistent UI, with `<Outlet />` from React Router in the main content area. `<Outlet />` renders whatever child route is currently matched. This means the sidebar and navbar are rendered once and stay mounted as the user navigates between pages — only the content area changes. This is the standard layout pattern in React Router v6+.

---

**Q45. How do you handle loading and error states in the UI?**

`useRequests` exposes `loading` and `error` booleans. While `loading` is true, the `RequestTable` renders skeleton rows (gray animated placeholder divs). If `error` is set, a red error banner is shown. If the fetch succeeds but returns an empty array, `EmptyState` is rendered. This covers all three states: loading, error, and empty — preventing blank screens.

---

**Q46. How does the `buildQueryString` utility work?**

It takes a params object, creates a `URLSearchParams` instance, and iterates over the entries. It only appends a key-value pair if the value is not `undefined`, `null`, or an empty string — this prevents sending `?status=&priority=` in the URL. It returns the resulting query string. This is used in `api/requests.js` to build the URL for `GET /requests`.

---

---

## 🟡 MEDIUM PRIORITY — TypeScript & Code Quality

---

**Q47. How is TypeScript used on the backend?**

The entire server is written in TypeScript. Key uses: the `AuthenticatedRequest` type extends Express's `Request` to add `authenticatedUser: User`, giving type-safe access to the logged-in user in controllers. Prisma generates TypeScript types from the schema, so all database queries are type-checked. Zod schemas infer TypeScript types for request bodies. `tsconfig.json` is configured with strict mode.

---

**Q48. What is the `AuthenticatedRequest` type and why is it needed?**

Express's default `Request` type doesn't have an `authenticatedUser` property. After the `authenticate` middleware runs, it attaches the user to the request object. To access it in controllers without TypeScript errors, a custom `AuthenticatedRequest` interface extends `Request` and adds `authenticatedUser: User`. Controllers cast `req as AuthenticatedRequest` to get type-safe access.

---

**Q49. How does the `toPublicUser` function work and why is it important?**

`toPublicUser` takes a full `User` object from the database (which includes the `password` hash) and returns a new object with the `password` field omitted. This ensures the password hash is never sent to the client in any API response. It is called in every auth controller response and in `getCurrentUser`.

---

**Q50. How is the project structured to separate concerns?**

The backend follows a layered architecture: routers handle routing, controllers handle HTTP request/response, services contain business logic (auth service), middlewares handle cross-cutting concerns (auth, error handling, logging), validators define input schemas, and utils contain helpers. This means controllers are thin — they parse input, call a service, and return the result. Business logic lives in services, not controllers.

---

## 🟡 MEDIUM PRIORITY — Debugging & Problem Solving

---

**Q51. Describe a bug you encountered and how you fixed it.**

The 401 redirect loop: `AuthContext` calls `/auth/me` on load. When unauthenticated, the backend returns `401`. The Axios interceptor caught this and redirected to `/login`, which reloaded the app, which called `/auth/me` again — infinite loop. I diagnosed it by reading the interceptor and `AuthContext` together and noticing the circular dependency. The fix was adding `url.includes('/auth/me')` check in the interceptor to skip the redirect for that specific call.

---

**Q52. How did you debug the Prisma stale types issue?**

After adding the `password` field to the schema and running `prisma migrate`, TypeScript still showed errors because the IDE was using a cached version of the generated Prisma client. The fix was running `npx prisma generate` explicitly to regenerate `node_modules/.prisma/client/index.d.ts`, then restarting the TypeScript language server. This is a common Prisma gotcha — migrations update the database but you must also regenerate the client.

---

**Q53. How did you handle the migration timeout issue?**

`prisma migrate dev` timed out because it waits for interactive confirmation in the terminal. The fix was passing `--skip-seed` to avoid the interactive seed prompt, and using `prisma migrate deploy` (non-interactive) for applying migrations in environments where interaction isn't possible. This is important to know for CI/CD pipelines.

---

## 🟢 LOW PRIORITY — Tooling & DevOps

---

**Q54. Why did you choose Vite over Create React App?**

Vite uses native ES modules in development, so it only transforms files on demand rather than bundling everything upfront. This makes the dev server start nearly instant and HMR (hot module replacement) extremely fast. CRA uses Webpack which bundles everything on start — slow for large projects. Vite also has a simpler config and better TypeScript support out of the box.

---

**Q55. What does `withCredentials: true` do in Axios and when is it required?**

By default, browsers block cookies from being sent on cross-origin requests. `withCredentials: true` tells the browser to include cookies (and other credentials) on cross-origin requests. It is required here because the frontend (`localhost:5173`) and backend (`localhost:3000`) are on different ports, making them different origins. The backend must also set `Access-Control-Allow-Credentials: true` (via `cors({ credentials: true })`), otherwise the browser still blocks it.

---

**Q56. How does Tailwind CSS work in this project?**

Tailwind is a utility-first CSS framework — instead of writing custom CSS classes, you compose utility classes directly in JSX (`className="flex items-center gap-4 rounded-lg bg-white p-4"`). The `tailwind.config.js` specifies the `content` paths so Tailwind can tree-shake unused classes in the production build. `postcss.config.js` integrates Tailwind into the Vite build pipeline.

---

**Q57. What is the purpose of the `vercel.json` file in the client?**

It configures Vercel deployment for the React SPA. The key setting is a rewrite rule that redirects all routes to `index.html` — this is necessary because React Router handles routing client-side. Without this, navigating directly to `/dashboard` on Vercel would return a 404 because there is no actual `dashboard.html` file on the server.

---

**Q58. How does nodemon work with TypeScript in the dev setup?**

`nodemon` watches for file changes and restarts the server. Since the server is TypeScript, `ts-node` is used to execute `.ts` files directly without a separate compile step. The `npm run dev` script runs `nodemon --exec ts-node src/server.ts`. This gives a fast development loop — save a file, nodemon detects the change, ts-node re-executes the server.

---

## 🟢 LOW PRIORITY — Features & UX Decisions

---

**Q59. Why does the login form require role selection?**

It is a deliberate security design. The backend validates that the submitted role matches the stored role. This prevents an employee who knows a manager's password from logging in with manager privileges. The role acts as a second verification factor. It also makes the system's role model explicit to the user.

---

**Q60. How does the CSV export respect active filters?**

The `getExportUrl()` function in `api/requests.js` takes the current `params` object (which includes all active filters) and builds a query string with `buildQueryString`. The export URL is `GET /requests/export?status=APPROVED&department=Production` etc. The backend's export handler uses the same filter logic as the list endpoint, so the exported CSV always matches what the user sees on screen.

---

**Q61. Why is the `EmptyState` component a separate component?**

It is reused in multiple places — `RequestsPage` (no requests matching filters), `ApprovalPage` (no pending requests), and potentially others. Extracting it avoids duplicating the centered icon + title + description + optional action button pattern. It accepts `title`, `description`, and an optional `action` prop for a CTA button.

---

**Q62. How does the activity timeline on the dashboard work?**

`DashboardPage` calls `GET /dashboard/activity` which returns the last 10 `AuditLog` entries, scoped by role. Each entry has `action`, `performedBy.name`, `request.itemName`, `remarks`, and `createdAt`. The `ActivityTimeline` component renders them as a vertical list with a colored dot, the action label, the item name, the performer, and the `timeAgo` formatted timestamp.

---

**Q63. What are the known limitations of this project and how would you improve it?**

Key limitations:
- No email verification on registration
- No password reset flow
- Role is self-selected — no admin approval
- No real-time notifications (WebSocket/polling)
- No edit functionality for DRAFT requests
- No unit or integration tests
- No Docker setup for easy deployment

Improvements I'd prioritize: add Vitest + React Testing Library for frontend tests, Jest + Supertest for backend, add a Dockerfile + docker-compose, implement email verification, and add a rate limiter on auth endpoints.

---

**Q64. How would you add real-time notifications to this system?**

I'd use WebSockets via Socket.io. When a manager approves or rejects a request, the server emits an event to the room for that request's creator. The frontend subscribes to that room on login. Alternatively, for simpler implementation, server-sent events (SSE) could push notifications from server to client without the overhead of full WebSocket bidirectional communication.

---

**Q65. How would you add unit tests to this project?**

For the backend: Jest + Supertest for integration tests on the API routes, mocking Prisma with `jest-mock-extended`. For the frontend: Vitest + React Testing Library for component tests, mocking Axios with `msw` (Mock Service Worker) to intercept API calls. I'd prioritize testing the auth flow, the `useRequests` hook, `ProtectedRoute` behavior, and the approval workflow as the highest-value test cases.

---

*Good luck with your interview, Saurav!*
