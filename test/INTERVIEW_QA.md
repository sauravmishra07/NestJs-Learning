# Mini ERP System - Interview Q&A Document

> **Preparation for Virtual Round Interview**  
> Candidate: [Your Name]  
> Project: Purchase Request Management Module  
> Date Prepared: June 1, 2026

---

## Table of Contents

1. [HIGH PRIORITY Questions (30 Questions)](#high-priority-questions)
2. [MEDIUM PRIORITY Questions (25 Questions)](#medium-priority-questions)
3. [LOW PRIORITY Questions (15 Questions)](#low-priority-questions)

---

## HIGH PRIORITY Questions

### 1. Project Overview & Architecture

#### Q1: Can you give a brief overview of the Mini ERP project you built?

**Answer:**
The Mini ERP is a full-stack Purchase Request Management Module that enables employees to create purchase requests and managers/admins to review, approve, or reject them. The system has:

**Key Features:**

- Role-based access control (EMPLOYEE, MANAGER, ADMIN)
- Complete audit trail for every request action
- Draft/Submit/Approve/Reject workflow
- CSV export functionality
- Modern dashboard with statistics
- Authentication via email/password and Google OAuth 2.0

**Tech Stack:**

- **Backend:** Node.js, Express 5, TypeScript, PostgreSQL, Prisma 6
- **Frontend:** React 19, Vite, Tailwind CSS, React Router
- **Authentication:** JWT + bcryptjs
- **Validation:** Zod schema validation
- **Logging:** Winston with daily rotation

**Architecture:**

- **Backend:** RESTful API with v1 and v2 routing
- **Frontend:** Component-based with context API for state management
- **Database:** PostgreSQL with Prisma ORM

---

#### Q2: What are the main roles in your system and their responsibilities?

**Answer:**

| Role         | Permissions                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| **EMPLOYEE** | Create requests (draft/submit), view own requests and audit trail              |
| **MANAGER**  | View all requests, approve/reject submitted requests, add remarks, export data |
| **ADMIN**    | Full system access (same as MANAGER + system management)                       |

**Role-Based Access Examples:**

```
- Employees can only see their own requests
- Managers can see and modify all requests
- Dashboard shows role-specific statistics (employees see own, managers see all)
- API enforces role checks via middleware: requireRole("MANAGER", "ADMIN")
```

---

#### Q3: Explain the workflow of a purchase request from creation to approval.

**Answer:**

1. **DRAFT State** (Initial)
   - Employee creates a request with details (item, quantity, department, reason, priority, required date)
   - Request saved in DRAFT status
   - Audit log created with action: CREATED
   - Employee can edit or submit from draft

2. **SUBMITTED State**
   - Employee submits the request
   - Status changed from DRAFT → SUBMITTED
   - Audit log created with action: SUBMITTED
   - Request now visible to managers

3. **MANAGER REVIEW**
   - Manager views pending requests on dashboard
   - Can approve with optional remarks
   - Can reject with remarks (reason for rejection)

4. **APPROVED State**
   - Manager approves request
   - Status changed to APPROVED
   - Audit log created: oldStatus: SUBMITTED, newStatus: APPROVED, remarks stored
   - Requestor gets notification (via frontend toast)

5. **REJECTED State** (Alternative)
   - Manager rejects request
   - Status changed to REJECTED
   - Audit log with rejection reason
   - Employee can resubmit or create new request

**Data Consistency:**

- All transitions logged in AuditLog table
- Timestamps recorded for compliance
- Performed by information preserved for accountability

---

#### Q4: What is the database schema design, and why did you choose this structure?

**Answer:**

**Three Main Tables:**

```prisma
User {
  id: UUID (PK)
  email: String (UNIQUE)
  name: String
  avatar: String? (from OAuth)
  password: String? (null for OAuth users)
  role: Role (EMPLOYEE | MANAGER | ADMIN)
  createdAt, updatedAt
}

PurchaseRequest {
  id: UUID (PK)
  itemName: String
  quantity: Float
  unit: String (pcs, kg, litre, etc.)
  department: String
  requiredDate: DateTime
  reason: String
  priority: Priority (LOW | MEDIUM | HIGH)
  status: Status (DRAFT | SUBMITTED | APPROVED | REJECTED)
  createdById: String (FK → User.id)
  createdAt, updatedAt
}

AuditLog {
  id: UUID (PK)
  action: AuditAction (CREATED | UPDATED | SUBMITTED | APPROVED | REJECTED)
  oldStatus: Status?
  newStatus: Status?
  remarks: String? (manager comments)
  requestId: String (FK → PurchaseRequest.id)
  performedById: String (FK → User.id)
  createdAt
}
```

**Design Rationale:**

1. **UUID for IDs** - Prevents ID enumeration attacks
2. **Separate Audit Table** - Provides complete history and audit trail
3. **Enums for Status/Priority** - Database-level constraint, type safety
4. **Nullable Password** - Support both email/password and OAuth users
5. **Timestamp Fields** - Enables sorting, filtering by date ranges
6. **Foreign Keys** - Referential integrity, cascade protection
7. **Role-Based Filtering** - createdById allows employee-specific filtering

**Design Benefits:**

- Compliance: Full audit trail for regulatory requirements
- Performance: Indexed FK fields for quick lookups
- Data Integrity: Constraints prevent invalid states
- Scalability: Clean relationships allow future reporting features

---

#### Q5: How does authentication work in your system?

**Answer:**

**Dual Authentication Strategy:**

**1. Email/Password Authentication:**

```typescript
// Registration flow
register(name, email, password, role) {
  1. Validate input with Zod schema
  2. Check if email already exists
  3. Hash password using bcryptjs with salt rounds
  4. Create user in database
  5. Generate JWT token
  6. Set secure HTTP-only cookie
  7. Return user (without password)
}

// Login flow
login(email, password) {
  1. Validate input schema
  2. Find user by email
  3. Compare password hash with bcryptjs.compare()
  4. Generate JWT token
  5. Set secure HTTP-only cookie
  6. Return user
}
```

**2. Google OAuth 2.0:**

```typescript
// Passport.js strategy configuration
GoogleStrategy {
  clientID: process.env.GOOGLE_CLIENT_ID
  clientSecret: process.env.GOOGLE_CLIENT_SECRET
  callbackURL: /api/v1/auth/google/callback
}

Flow:
1. Frontend redirects to /api/v1/auth/google
2. Google shows consent screen
3. User approves scope (profile, email)
4. Google redirects to callback with auth code
5. Passport exchanges code for profile
6. User upserted in database (null password for OAuth users)
7. JWT token generated and set in cookie
8. Redirect to frontend dashboard
```

**Token Management:**

```typescript
// JWT Structure
Token payload: {
  id: user.id,
  email: user.email,
  role: user.role
}

// Cookie Configuration
{
  httpOnly: true,          // Prevent XSS attacks
  secure: isProduction,    // HTTPS only in production
  sameSite: "none" | "lax", // CSRF protection
  maxAge: 7 days,          // Expiration
  path: "/"
}

// Token extraction
1. Check HTTP-only cookie (primary)
2. Check Authorization header with "Bearer " prefix (fallback)
```

**Session Management:**

```typescript
// Middleware: authenticate()
1. Extract token from cookie or header
2. Verify JWT signature
3. Decode payload and get userId
4. Query database for user
5. Attach user to request.authenticatedUser
6. Pass to next middleware

// Protected routes use: app.use('/api/v1', authenticate)
```

**Security Features:**

- Passwords never stored in plaintext
- Tokens validated server-side before each request
- HTTP-only cookies prevent XSS access
- CORS restrictions on frontend origins
- Expired tokens reject with 401 Unauthorized

---

#### Q6: What middleware do you use and what does each do?

**Answer:**

**1. Authentication Middleware**

```typescript
authenticate(req, res, next)
├─ Extract token from cookie or Authorization header
├─ Verify JWT signature
├─ Fetch user from DB
├─ Attach user to req.authenticatedUser
└─ Call next() or throw UnauthorizedError
```

**Used on:** All protected `/api/v1/*` routes
**Throws:** UnauthorizedError (401) if token missing/invalid

**2. Role-Based Authorization**

```typescript
requireRole(...roles: Role[])
├─ Check req.authenticatedUser.role
├─ Verify role is in allowed list
└─ Throw ForbiddenError if unauthorized
```

**Examples:**

```
GET /requests → requireRole("MANAGER", "ADMIN")
PUT /requests/:id/approve → requireRole("MANAGER", "ADMIN")
DELETE /requests/:id → requireRole("ADMIN")
```

**3. CORS Middleware**

```typescript
cors({
  origin: [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    /^https:\/\/mini-erp-system-[a-z0-9]+-*.vercel.app$/,
  ],
  credentials: true, // Allow cookies
});
```

**Purpose:** Prevent cross-origin attacks, whitelist only trusted origins

**4. JSON Parser**

```typescript
express.json()
└─ Parse request body JSON
```

**5. Cookie Parser**

```typescript
cookieParser()
└─ Parse cookies from headers into req.cookies object
```

**6. Correlation ID Middleware**

```typescript
attachCorrelationIdMiddleware
├─ Generate or extract correlation-id from headers
├─ Add to logger context
└─ Include in responses for tracing
```

**Purpose:** Track requests across logs for debugging

**7. Error Handler Middleware**

```typescript
errorHandler(err, req, res, next)
├─ Check error type (AppError vs generic)
├─ Extract statusCode, message
├─ Log error with context
└─ Send JSON response with error details
```

**Priority Order:** CORS → JSON → Cookies → Routes → Error Handler

---

#### Q7: How do you handle errors and validation in your backend?

**Answer:**

**Custom Error Classes:**

```typescript
// Base AppError
class AppError extends Error {
  statusCode: number
  message: string
}

// Specific errors
UnauthorizedError(401) - Auth required
ForbiddenError(403) - Insufficient permissions
NotFoundError(404) - Resource not found
BadRequestError(400) - Invalid input
```

**Validation Strategy:**

**1. Input Validation with Zod:**

```typescript
createRequestSchema = z.object({
  itemName: z.string().min(1, "required"),
  quantity: z.number().positive("must be > 0"),
  unit: z.string().min(1),
  department: z.string().min(1),
  requiredDate: z.string().datetime("ISO 8601 format"),
  reason: z.string().min(10, "at least 10 chars"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

// Usage in controller
export const createRequest = async (req, res, next) => {
  try {
    const validated = createRequestSchema.parse(req.body);
    // Create request...
  } catch (error) {
    next(error); // Zod errors handled by error middleware
  }
};
```

**2. Business Logic Validation:**

```typescript
// Check if request exists
const request = await prisma.purchaseRequest.findUnique({
  where: { id: requestId },
});
if (!request) {
  throw new NotFoundError("Request not found");
}

// Check permissions
if (user.role === "EMPLOYEE" && user.id !== request.createdById) {
  throw new ForbiddenError("Cannot modify others' requests");
}

// Check state transitions
if (request.status !== "DRAFT") {
  throw new BadRequestError("Only DRAFT requests can be submitted");
}
```

**3. Global Error Handler:**

```typescript
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Generic error
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});
```

**Error Flow:**

```
Controller raises AppError
    ↓
Error middleware catches it
    ↓
Checks error type (AppError vs ZodError vs generic)
    ↓
Logs with correlation ID
    ↓
Sends JSON response with statusCode and message
```

**Frontend Error Handling:**

```javascript
// In API module
export async function createRequest(data) {
  try {
    const response = await axios.post("/api/v1/requests", data);
    return response;
  } catch (error) {
    // Backend error
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}

// In component
try {
  await createRequest(data);
  toast.success("Request created");
} catch (error) {
  toast.error(getErrorMessage(error));
}
```

---

#### Q8: Describe the API structure and routing design.

**Answer:**

**API Structure:**

```
/api/v1/  (Current version)
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── GET /me
│   ├── POST /logout
│   └── GET /google
│
├── /requests
│   ├── GET / (list with filters)
│   ├── POST / (create)
│   ├── GET /:id (detail)
│   ├── PUT /:id (update)
│   ├── PUT /:id/submit (change to SUBMITTED)
│   ├── PUT /:id/approve (approve)
│   ├── PUT /:id/reject (reject)
│   └── GET /export/csv (export filtered requests)
│
└── /dashboard
    ├── GET /stats (total, pending, approved, rejected)
    └── GET /activity (recent audit logs)

/api/v2/  (Future version)
└── (Additional features planned)
```

**Routing Architecture:**

```typescript
// server.ts
import v1Router from "./routers/v1/index.router";

app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);

// v1/index.router.ts
const router = express.Router();

router.use("/auth", authRouter);
router.use("/requests", authenticate, requestRouter);
router.use("/dashboard", authenticate, dashboardRouter);

// v1/request.router.ts
router.get("/", getAllRequests);
router.post("/", validateSchema(createRequestSchema), createRequest);
router.get("/:id", getRequest);
router.put("/:id", updateRequest);
router.put("/:id/submit", submitRequest);
router.put("/:id/approve", requireRole("MANAGER", "ADMIN"), approveRequest);
router.put("/:id/reject", requireRole("MANAGER", "ADMIN"), rejectRequest);
router.get("/export/csv", requireRole("MANAGER", "ADMIN"), exportRequests);
```

**Middleware Application:**

```
Request → CORS → JSON Parser → Cookie Parser
  ↓
/api/v1 → Authentication Middleware
  ↓
Route Handler
  ↓
Controller Logic
  ↓
Response ← Error Handler
```

**Response Format (Standardized):**

```typescript
// Success Response
{
  success: true,
  data: {
    request: { ... }
  }
}

// Error Response
{
  success: false,
  error: "Validation failed",
  details: [...]  // optional
}
```

---

#### Q9: How do you implement role-based access control (RBAC)?

**Answer:**

**RBAC Implementation:**

**1. Database Level:**

```prisma
enum Role {
  EMPLOYEE
  MANAGER
  ADMIN
}

model User {
  ...
  role: Role @default(EMPLOYEE)
}
```

**2. Middleware Level:**

```typescript
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).authenticatedUser;

    if (!roles.includes(user.role)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    next();
  };

// Usage
router.put(
  "/:id/approve",
  authenticate,
  requireRole("MANAGER", "ADMIN"),
  approveRequest,
);
```

**3. Controller/Service Level:**

```typescript
export const getAllRequests = async (req, res) => {
  const user = getUser(req);

  // Managers/Admins see all requests
  // Employees see only their own
  const isManager = [Role.MANAGER, Role.ADMIN].includes(user.role);

  const where = isManager ? {} : { createdById: user.id };

  const requests = await prisma.purchaseRequest.findMany({
    where,
    include: { createdBy: { select: { name: true, email: true } } },
  });

  res.json({ success: true, data: { requests } });
};
```

**4. Frontend Level (UI-based RBAC):**

```jsx
// App.jsx - Protected routes
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute
            requiredRole={null} // All authenticated users
          >
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute
            requiredRole="MANAGER" // Only managers
          >
            <ApprovalPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

// ProtectedRoute.jsx
function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  if (!user) return <Navigate to="/login" />;

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" />;
  }

  return children;
}
```

**5. Permission Matrix:**

```
Endpoint                    EMPLOYEE    MANAGER    ADMIN
─────────────────────────────────────────────────────
GET /requests               Own only    All        All
POST /requests              ✓           ✓          ✓
PUT /:id/approve            ✗           ✓          ✓
PUT /:id/reject             ✗           ✓          ✓
GET /export/csv             ✗           ✓          ✓
GET /dashboard/stats        Own only    All        All
```

**Benefits:**

- Security enforced at multiple layers
- Frontend prevents unauthorized navigation
- Backend prevents unauthorized API access
- Database constraints ensure role validity

---

#### Q10: Explain the audit logging system.

**Answer:**

**Audit Log Design:**

```prisma
model AuditLog {
  id: String @id @default(uuid())
  action: AuditAction        // CREATED, SUBMITTED, APPROVED, REJECTED
  oldStatus: Status?         // Previous status
  newStatus: Status?         // New status
  remarks: String?           // Manager's comments
  createdAt: DateTime        // Timestamp

  request: PurchaseRequest   // Which request
  performedBy: User          // Who performed action
}

enum AuditAction {
  CREATED
  UPDATED
  SUBMITTED
  APPROVED
  REJECTED
}
```

**Audit Logging in Controllers:**

```typescript
const writeAudit = async (
  requestId: string,
  performedById: string,
  action: AuditAction,
  oldStatus?: Status,
  newStatus?: Status,
  remarks?: string
) => {
  await prisma.auditLog.create({
    data: {
      requestId,
      performedById,
      action,
      oldStatus,
      newStatus,
      remarks
    }
  })
}

// When creating request
export const createRequest = async (req, res, next) => {
  const request = await prisma.purchaseRequest.create({
    data: { ... }
  })

  await writeAudit(
    request.id,
    user.id,
    AuditAction.CREATED,
    undefined,
    Status.DRAFT
  )

  res.status(201).json({ success: true, data: { request } })
}

// When approving request
export const approveRequest = async (req, res, next) => {
  const request = await prisma.purchaseRequest.findUnique({ ... })

  const updated = await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: Status.APPROVED }
  })

  await writeAudit(
    requestId,
    user.id,
    AuditAction.APPROVED,
    Status.SUBMITTED,
    Status.APPROVED,
    remarks
  )

  res.json({ success: true, data: { request: updated } })
}
```

**Retrieving Audit History:**

```typescript
export const getRecentActivity = async (req, res) => {
  const user = getUser(req);
  const isManager = [Role.MANAGER, Role.ADMIN].includes(user.role);

  const logs = await prisma.auditLog.findMany({
    where: isManager
      ? undefined // All logs
      : { request: { createdById: user.id } }, // Own logs only
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      performedBy: { select: { name: true, avatar: true } },
      request: { select: { itemName: true } },
    },
  });

  res.json({ success: true, data: { logs } });
};
```

**Frontend Display:**

```jsx
// ActivityTimeline.jsx - Shows audit trail
function ActivityTimeline({ logs }) {
  return (
    <div className="space-y-4">
      {logs.map(log => (
        <div key={log.id} className="border-l-2 pl-4">
          <div className="font-semibold text>{
            `${log.performedBy.name} ${log.action}`
          }</div>

          {log.oldStatus && log.newStatus && (
            <div className="text-sm text-gray-600">
              {log.oldStatus} → {log.newStatus}
            </div>
          )}

          {log.remarks && (
            <div className="text-sm italic">
              "{log.remarks}"
            </div>
          )}

          <div className="text-xs text-gray-400">
            {formatDate(log.createdAt)}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Compliance Benefits:**

- Complete history of all actions
- Who did what and when
- Reason for decisions (remarks)
- Track status transitions
- Accountability for managers
- Non-repudiation for approvals

---

---

### 2. Database & Performance

#### Q11: How do you optimize database queries?

**Answer:**

**1. Query Optimization Techniques:**

```typescript
// ❌ N+1 Problem
const requests = await prisma.purchaseRequest.findMany();
const withUsers = await Promise.all(
  requests.map((r) =>
    prisma.user.findUnique({
      where: { id: r.createdById },
    }),
  ),
);

// ✓ Use include()
const requests = await prisma.purchaseRequest.findMany({
  include: {
    createdBy: { select: { id: true, name: true, email: true } },
  },
});
```

**2. Selective Field Selection:**

```typescript
// ❌ Fetch unnecessary fields
const users = await prisma.user.findMany();

// ✓ Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    // password excluded
  },
});
```

**3. Pagination for Large Results:**

```typescript
export const getAllRequests = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const [requests, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseRequest.count(),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      requests,
      total,
      page,
      totalPages,
    },
  });
};
```

**4. Efficient Filtering:**

```typescript
// Filter with where clause
const where: Prisma.PurchaseRequestWhereInput = {
  AND: [
    status === "SUBMITTED" ? { status: "SUBMITTED" } : {},
    department ? { department } : {},
    priority ? { priority } : {},
    from ? { createdAt: { gte: new Date(from) } } : {},
    to ? { createdAt: { lte: new Date(to) } } : {},
  ].filter((obj) => Object.keys(obj).length > 0),
};

const requests = await prisma.purchaseRequest.findMany({
  where,
  skip: (page - 1) * limit,
  take: limit,
});
```

**5. Batch Operations:**

```typescript
// ✓ Parallel queries
const [total, pending, approved, rejected] = await Promise.all([
  prisma.purchaseRequest.count({ where }),
  prisma.purchaseRequest.count({
    where: { ...where, status: Status.SUBMITTED },
  }),
  prisma.purchaseRequest.count({
    where: { ...where, status: Status.APPROVED },
  }),
  prisma.purchaseRequest.count({
    where: { ...where, status: Status.REJECTED },
  }),
]);
```

**6. Database Indexing (in schema.prisma):**

```prisma
model PurchaseRequest {
  ...
  status: Status
  createdById: String

  // Implicit indexes on FK fields
  // Could add explicit indexes for frequent filters:
  @@index([status])
  @@index([createdById])
  @@index([priority])
}
```

**Performance Impact:**

- Pagination: Reduces memory, faster response
- Includes: Reduces round trips, faster response
- Select: Smaller payload, less bandwidth
- Indexes: Faster WHERE filtering

---

#### Q12: How do you handle database migrations?

**Answer:**

**Migration Strategy:**

**1. Create Migration:**

```bash
# Development only
npm run prisma:migrate

# This:
# 1. Detects schema changes in schema.prisma
# 2. Generates migration file in migrations/ folder
# 3. Executes migration on dev database
# 4. Re-generates Prisma Client
```

**2. Migration File Structure:**

```
prisma/migrations/
├── migration_lock.toml  (Locks to PostgreSQL provider)
├── 20260523104038_users_table/
│   └── migration.sql
├── 20260523105106_purchase_request_table/
│   └── migration.sql
└── 20260524143401_add_password_to_users/
    └── migration.sql
```

**Example migration.sql:**

```sql
-- CreateTable users
CREATE TABLE "users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "password" TEXT,
  "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**3. Database Seeding:**

```typescript
// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.user.deleteMany();

  // Create test users
  const employee = await prisma.user.create({
    data: {
      id: "1",
      email: "employee@example.com",
      name: "John Employee",
      password: hashedPassword,
      role: Role.EMPLOYEE,
    },
  });

  const manager = await prisma.user.create({
    data: {
      id: "2",
      email: "manager@example.com",
      name: "Jane Manager",
      password: hashedPassword,
      role: Role.MANAGER,
    },
  });

  // Create dummy requests
  await prisma.purchaseRequest.create({
    data: {
      itemName: "Laptop",
      quantity: 5,
      unit: "pcs",
      department: "IT",
      requiredDate: new Date(),
      reason: "Team expansion",
      priority: "HIGH",
      createdById: employee.id,
    },
  });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
```

**4. Run Seeding:**

```bash
npm run prisma:seed
```

**5. Production Deployment:**

```bash
# In production CI/CD
prisma generate
prisma migrate deploy  # Applies migrations in migrations/ folder

# NOT migrate dev (which creates new migrations)
# Migrations already committed to git
```

**Best Practices:**

- Commit migrations to git
- Never modify applied migrations (create new one)
- Test migrations locally before deploying
- Always backup database before major migrations
- Use `prisma:migrate deploy` in production

---

#### Q13: What is Prisma and why did you choose it as your ORM?

**Answer:**

**Prisma Overview:**

Prisma is a modern ORM (Object-Relational Mapping) tool for Node.js and TypeScript that provides type-safe database access.

**Key Features:**

1. **Schema-Driven Development**

   ```prisma
   // Single source of truth for database structure
   model User {
     id String @id @default(uuid())
     email String @unique
     requests PurchaseRequest[]
   }
   ```

2. **Type Safety**

   ```typescript
   // Fully typed queries
   const user = await prisma.user.findUnique({
     where: { id: "123" },
   });
   // user: User | null (TypeScript knows the shape)
   ```

3. **Intuitive API**

   ```typescript
   await prisma.user.create({ data: {...} })
   await prisma.user.findMany({ where: {...} })
   await prisma.user.update({ where: {...}, data: {...} })
   await prisma.user.delete({ where: {...} })
   ```

4. **Relations Support**
   ```typescript
   const user = await prisma.user.findUnique({
     where: { id: "1" },
     include: {
       requests: true,
       auditLogs: true,
     },
   });
   ```

**Why Prisma?**

| Criteria             | Prisma               | Alternative (TypeORM/Sequelize) |
| -------------------- | -------------------- | ------------------------------- |
| TypeScript Support   | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good                     |
| Learning Curve       | ⭐⭐⭐⭐⭐ Easy      | ⭐⭐⭐ Moderate                 |
| Database Migrations  | ⭐⭐⭐⭐⭐ Built-in  | ⭐⭐⭐ Separate tool            |
| IDE Autocomplete     | ⭐⭐⭐⭐⭐ Perfect   | ⭐⭐⭐ Good                     |
| Query Performance    | ⭐⭐⭐⭐ Good        | ⭐⭐⭐⭐ Good                   |
| Developer Experience | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Good                   |

**Comparison with SQL:**

```typescript
// With SQL
const user = await query("SELECT * FROM users WHERE id = $1", [id]);
// Returns: any[] (no type safety)

// With Prisma
const user = await prisma.user.findUnique({ where: { id } });
// Returns: User | null (fully typed)
```

**Chosen for:**

- Type safety reduces bugs
- Modern API is intuitive
- Migration management built-in
- Excellent TypeScript support
- Generates Prisma Client automatically

---

#### Q14: Explain how you handle concurrent requests and database transactions.

**Answer:**

**Concurrent Request Handling:**

**1. Prisma's Connection Pooling:**

```typescript
// .env
DATABASE_URL = "postgresql://user:password@localhost:5432/db?schema=public";

// Prisma automatically handles:
// - Connection pool (default 2 connections per CPU)
// - Query queuing
// - Connection reuse
```

**2. Managing Concurrent Requests:**

```typescript
// Without transaction risk - Race condition
export const approveRequest = async (req, res) => {
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: requestId }
  })

  // Another request might change status here (RACE CONDITION)

  await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: Status.APPROVED }
  })
}

// With transaction - Atomic operation
export const approveRequest = async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.purchaseRequest.findUnique({
      where: { id: requestId }
    })

    if (request.status !== Status.SUBMITTED) {
      throw new BadRequestError("Can only approve SUBMITTED requests")
    }

    // If another request changes status in parallel,
    // the update will fail (safe)
    const updated = await tx.purchaseRequest.update({
      where: { id: requestId },
      data: { status: Status.APPROVED }
    })

    await tx.auditLog.create({
      data: { ... }
    })

    return updated
  })

  res.json({ success: true, data: { request: result } })
}
```

**3. Transaction Pattern:**

```typescript
// Multiple operations guaranteed to succeed or rollback
await prisma.$transaction(async (tx) => {
  // Operation 1
  const request = await tx.purchaseRequest.update({...})

  // Operation 2
  await tx.auditLog.create({...})

  // Operation 3
  await tx.user.update({...})

  // If any fails, all rollback automatically
  // If all succeed, all commit together
})
```

**4. Optimistic Concurrency Control:**

```prisma
// Version field to detect concurrent modifications
model PurchaseRequest {
  ...
  version Int @default(0)
}
```

```typescript
export const updateRequest = async (req, res) => {
  const { version } = req.body;

  const updated = await prisma.purchaseRequest.update({
    where: {
      id: requestId,
      version: version, // Only update if version matches
    },
    data: {
      ...updateData,
      version: { increment: 1 }, // Increment version
    },
  });

  // If version doesn't match, update() throws error (409 Conflict)
  res.json({ success: true, data: { request: updated } });
};
```

**5. Database-Level Constraints:**

```prisma
model PurchaseRequest {
  ...
  status Status @default(DRAFT)

  // Constraint: can't have null createdById
  createdById String
  createdBy User @relation(fields: [createdById], references: [id])

  @@index([status])  // Fast queries on status
}
```

**Benefits:**

- Transactions prevent race conditions
- Database constraints enforce data integrity
- Connection pooling handles concurrent requests
- Version fields detect conflicts

---

---

### 3. Backend API Design

#### Q15: How do you implement filtering, sorting, and pagination?

**Answer:**

**Pagination:**

```typescript
// Client requests
GET /api/v1/requests?page=1&limit=10

// Backend validation
const filterRequestSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10)
})

export const getAllRequests = async (req, res) => {
  const { page, limit, status, department, priority, from, to }
    = filterRequestSchema.parse(req.query)

  const skip = (page - 1) * limit

  const [requests, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where: {...},
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.purchaseRequest.count({ where: {...} })
  ])

  const totalPages = Math.ceil(total / limit)

  res.json({
    success: true,
    data: {
      requests,
      pagination: { page, limit, total, totalPages }
    }
  })
}
```

**Filtering:**

```typescript
const buildRequestWhereClause = (filters) => {
  const where = {};

  if (filters.status) {
    where.status = filters.status; // EXACT match
  }

  if (filters.department) {
    where.department = { contains: filters.department, mode: "insensitive" };
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) {
      where.createdAt.gte = new Date(filters.from);
    }
    if (filters.to) {
      where.createdAt.lte = new Date(filters.to);
    }
  }

  return where;
};

// Usage
const where = buildRequestWhereClause(filters);
const requests = await prisma.purchaseRequest.findMany({ where });
```

**Sorting:**

```typescript
// Client: GET /api/v1/requests?sortBy=createdAt&order=desc

const orderByMap = {
  createdAt: { createdAt: "desc" },
  priority: { priority: "desc" },
  status: { status: "asc" },
  itemName: { itemName: "asc" },
};

const orderBy = orderByMap[sortBy] || { createdAt: "desc" };

const requests = await prisma.purchaseRequest.findMany({
  orderBy,
});
```

**Frontend Implementation:**

```javascript
export function useRequests(initialParams = {}) {
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    status: undefined,
    department: undefined,
    priority: undefined,
    ...initialParams,
  });

  const fetch = useCallback(() => {
    getRequests(params).then((res) => {
      setRequests(res.data.data.requests);
      setMeta(res.data.data.pagination);
    });
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    requests,
    params,
    setParams, // For filtering/sorting
    ...meta,
  };
}

// In Component
function RequestsPage() {
  const { requests, params, setParams, totalPages, page } = useRequests();

  const handleFilter = (status) => {
    setParams((prev) => ({ ...prev, status, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setParams((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <>
      <FilterBar onFilter={handleFilter} />
      <RequestTable requests={requests} />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </>
  );
}
```

**Performance:**

- Pagination: Reduces memory, faster queries
- Filtering: Pre-computed WHERE clause
- Sorting: Database-level sorting (fast)
- Frontend pagination: No server refetch for page 1→2 if data cached

---

#### Q16: How do you handle CSV export?

**Answer:**

**CSV Export Implementation:**

```typescript
import { Parser } from "json2csv";

export const exportRequests = async (req, res) => {
  try {
    const user = getUser(req);
    const { status, department, priority, from, to } = req.query;

    // Build where clause same as getAllRequests
    const where = buildRequestWhereClause({
      status,
      department,
      priority,
      from,
      to,
    });

    // Only managers can export
    if (!["MANAGER", "ADMIN"].includes(user.role)) {
      throw new ForbiddenError("Export not allowed");
    }

    // Fetch filtered requests
    const requests = await prisma.purchaseRequest.findMany({
      where,
      include: {
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform data
    const exportData = requests.map((req) => ({
      ID: req.id,
      "Item Name": req.itemName,
      Quantity: req.quantity,
      Unit: req.unit,
      Department: req.department,
      Priority: req.priority,
      Status: req.status,
      "Requested By": req.createdBy.name,
      Email: req.createdBy.email,
      "Required Date": req.requiredDate,
      "Created At": req.createdAt,
      "Updated At": req.updatedAt,
    }));

    // Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(exportData);

    // Send as downloadable file
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="requests_${Date.now()}.csv"`,
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
```

**Frontend Trigger:**

```jsx
function RequestTable({ requests }) {
  const handleExport = async () => {
    try {
      const response = await axios.get("/api/v1/requests/export/csv", {
        responseType: "blob",
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `requests_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      toast.success("CSV exported successfully");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  return (
    <div>
      <button onClick={handleExport}>📥 Export CSV</button>
      {/* Table... */}
    </div>
  );
}
```

**CSV Features:**

- Includes all filtered requests
- Manager/Admin only (via middleware)
- Downloads as file with timestamp
- Human-readable column headers
- Completes with createdBy name/email

---

#### Q17: How do you version your API?

**Answer:**

**API Versioning Strategy:**

**1. File Structure:**

```
server/src/routers/
├── v1/
│   ├── index.router.ts (main router)
│   ├── auth.router.ts
│   ├── request.router.ts
│   └── dashboard.router.ts
└── v2/
    └── index.router.ts (future features)
```

**2. Server Setup:**

```typescript
import v1Router from "./routers/v1/index.router";
import v2Router from "./routers/v2/index.router";

app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
```

**3. V1 Router (Current):**

```typescript
// v1/index.router.ts
const router = express.Router();

router.use("/auth", authRouter);
router.use("/requests", authenticate, requestRouter);
router.use("/dashboard", authenticate, dashboardRouter);

export default router;
```

**4. V2 Router (Future):**

```typescript
// v2/index.router.ts
const router = express.Router();

// V2 endpoints might have:
// - Different response format
// - Additional filters
// - New features

router.use("/auth", authRouterV2);
router.use("/requests", requestRouterV2);

export default router;
```

**5. Backward Compatibility:**

```typescript
// Keep v1 unchanged
// New features go to v2

// V1 Response (stable)
{ success: true, data: { requests: [...] } }

// V2 Response (enhanced, different)
{
  success: true,
  data: {
    requests: [...],
    metadata: { ... }
  }
}
```

**6. API Client Configuration:**

```javascript
// axios.js
const API_VERSION = "v1"; // Easy to change

export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/${API_VERSION}`,
});

// Usage: GET /api/v1/requests
```

**Benefits:**

- Old clients keep working on v1
- New clients use v2 with enhancements
- No breaking changes
- Gradual migration possible

---

#### Q18: How do you handle real-time updates or status changes?

**Answer:**

**Current Implementation (Polling):**

Frontend uses polling to check for status updates:

```javascript
// hooks/useRequests.js
export function useRequests(initialParams = {}) {
  const [requests, setRequests] = useState([]);

  const fetch = useCallback(() => {
    getRequests(params)
      .then((res) => setRequests(res.data.data.requests))
      .catch((err) => console.error(err));
  }, [params]);

  useEffect(() => {
    fetch();

    // Poll every 5 seconds
    const interval = setInterval(fetch, 5000);

    return () => clearInterval(interval);
  }, [fetch]);

  return { requests, refetch: fetch };
}
```

**Limitations:**

- Not true real-time
- Extra API calls even if no changes
- Delay between change and display

**Future Enhancements - WebSocket (recommended):**

```typescript
// Backend: WebSocket setup with Socket.io
import { Server } from "socket.io";

const io = new Server(app, {
  cors: { origin: "http://localhost:5173" },
});

io.use(socketAuth); // Verify JWT token

io.on("connection", (socket) => {
  console.log("User connected:", socket.user.id);

  socket.on("subscribe_requests", () => {
    socket.join(`user:${socket.user.id}`);
  });
});

// When request status changes
export const approveRequest = async (req, res) => {
  const updated = await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: Status.APPROVED },
  });

  // Notify the requester
  io.to(`user:${updated.createdById}`).emit("request_approved", {
    requestId: updated.id,
    status: updated.status,
  });

  // Notify all managers
  io.to("role:manager").emit("new_approval", {
    requestId: updated.id,
    approvedBy: user.name,
  });
};
```

**Frontend WebSocket:**

```jsx
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export function useRealtimeRequests(initialRequests) {
  const [requests, setRequests] = useState(initialRequests);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL, {
      auth: { token: authToken },
    });

    socket.on("request_approved", ({ requestId, status }) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r)),
      );
      toast.success("Request approved!");
    });

    socket.on("new_approval", ({ requestId, approvedBy }) => {
      toast.info(`${approvedBy} approved a request`);
    });

    return () => socket.disconnect();
  }, []);

  return requests;
}
```

**Comparison:**

| Approach           | Latency    | Overhead | Complexity |
| ------------------ | ---------- | -------- | ---------- |
| Polling (current)  | 5s average | High     | Low        |
| WebSocket          | <100ms     | Low      | Medium     |
| Server-Sent Events | 1-2s       | Low      | Medium     |

---

---

### 4. Frontend Architecture

#### Q19: How does the React frontend structure handle state management?

**Answer:**

**State Management Layers:**

**1. Global State - AuthContext:**

```jsx
// context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    getMe()
      .then((res) => setUser(res.data.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

**Usage in App:**

```jsx
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
```

**2. Page-Level State - Custom Hooks:**

```jsx
// hooks/useRequests.js
export function useRequests(initialParams = {}) {
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 1,
    page: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState(initialParams);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);

    getRequests(params)
      .then((res) => {
        const { requests: reqs, total, totalPages, page } = res.data.data;
        setRequests(reqs);
        setMeta({ total, totalPages, page });
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    requests,
    total: meta.total,
    totalPages: meta.totalPages,
    page: meta.page,
    loading,
    error,
    params,
    setParams,
    refetch: fetch,
  };
}

// Usage in component
function RequestsPage() {
  const { requests, loading, error, page, totalPages, setParams } =
    useRequests();

  const handleFilter = (status) => {
    setParams((prev) => ({ ...prev, status, page: 1 }));
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <FilterBar onFilter={handleFilter} />
      <RequestTable requests={requests} />
      <Pagination page={page} totalPages={totalPages} />
    </>
  );
}
```

**3. Component-Level State:**

```jsx
// components/CreateRequestModal.jsx
function CreateRequestModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    itemName: '',
    quantity: '',
    unit: 'pcs',
    department: '',
    requiredDate: '',
    reason: '',
    priority: 'LOW'
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSubmit(formData)
      setFormData({...})  // Reset
      onClose()
      toast.success('Request created!')
    } catch (error) {
      setErrors(error.details || {})
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal>
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
      </form>
    </Modal>
  )
}
```

**State Management Hierarchy:**

```
App (AuthContext Provider)
  ├─ AuthContext
  │  └─ user, loading, setUser
  │
  ├─ Route: /dashboard
  │  └─ DashboardPage
  │     ├─ useRequests() [Page state]
  │     ├─ RequestsTable [Component state]
  │     └─ FilterBar [Component state]
  │
  └─ Route: /login
     └─ LoginPage [Component state]
```

**Benefits:**

- Global state (auth) accessible everywhere
- Page state (requests) fetched with params
- Component state (form) encapsulated
- Clear data flow and updates

---

#### Q20: How do you implement authentication on the frontend?

**Answer:**

**Frontend Authentication Flow:**

**1. Login Process:**

```jsx
// pages/LoginPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login } from "../api/auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Send credentials to backend
      const response = await login(email, password);

      // Backend returns user object and sets cookie
      setUser(response.data.data.user);

      // Navigate to dashboard
      navigate("/dashboard");

      toast.success("Login successful!");
    } catch (error) {
      setError(getErrorMessage(error));
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />

      <button disabled={loading}>{loading ? "Logging in..." : "Login"}</button>

      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

**2. Google OAuth Flow:**

```jsx
// components/GoogleOAuthButton.jsx
function GoogleOAuthButton() {
  const handleGoogleAuth = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${import.meta.env.VITE_API_URL}/api/v1/auth/google`;

    // Backend flow:
    // 1. Google shows consent screen
    // 2. User approves
    // 3. Redirected to /api/v1/auth/google/callback
    // 4. Backend creates/updates user
    // 5. Backend sets cookie
    // 6. Backend redirects to frontend dashboard
  };

  return <button onClick={handleGoogleAuth}>🔐 Login with Google</button>;
}
```

**3. Session Verification (on app load):**

```jsx
// context/AuthContext.jsx
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify session on app load
    getMe()
      .then((res) => {
        // Cookie valid, user logged in
        setUser(res.data.data.user);
      })
      .catch(() => {
        // Cookie invalid or expired
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**4. Protected Routes:**

```jsx
// components/ProtectedRoute.jsx
function ProtectedRoute({ children, requiredRole = null }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    // Not logged in, redirect to login
    return <Navigate to="/login" />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Logged in but not authorized
    return <Navigate to="/unauthorized" />;
  }

  // Logged in and authorized
  return children;
}

// Usage
<Route
  path="/approvals"
  element={
    <ProtectedRoute requiredRole="MANAGER">
      <ApprovalPage />
    </ProtectedRoute>
  }
/>;
```

**5. Axios Interceptor (Auto-attach token):**

```javascript
// api/axios.js
import axios from "axios";

export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
  withCredentials: true, // Auto-include cookies
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Cookies are automatically sent
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
```

**6. Logout:**

```jsx
// In Navbar or user menu
function LogoutButton() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout(); // Call backend
      setUser(null);
      navigate("/login");
      toast.success("Logged out");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  return <button onClick={handleLogout}>Logout</button>;
}
```

**Authentication Flow Summary:**

```
1. User enters credentials
2. Frontend sends to /api/v1/auth/login
3. Backend validates, hashes check, creates JWT
4. Backend sets HTTP-only cookie
5. Backend returns user object
6. Frontend stores user in context
7. Frontend redirects to dashboard
8. Subsequent requests include cookie automatically
9. Backend middleware validates token
10. On logout, clear user from context
```

---

---

## MEDIUM PRIORITY Questions

#### Q21: What validation do you use on the frontend?

**Answer:**

**1. React Hook Form:**

```jsx
import { useForm } from "react-hook-form";

function CreateRequestForm() {
  const { register, handleSubmit, errors } = useForm({
    defaultValues: {
      itemName: "",
      quantity: 1,
      priority: "LOW",
    },
  });

  const onSubmit = async (data) => {
    try {
      await createRequest(data);
      toast.success("Request created");
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register("itemName", {
          required: "Item name is required",
          minLength: {
            value: 1,
            message: "Enter item name",
          },
        })}
      />
      {errors.itemName && (
        <span className="error">{errors.itemName.message}</span>
      )}

      <input
        type="number"
        {...register("quantity", {
          required: "Quantity required",
          min: { value: 1, message: "Must be > 0" },
          max: { value: 10000, message: "Must be < 10000" },
        })}
      />
      {errors.quantity && (
        <span className="error">{errors.quantity.message}</span>
      )}

      <textarea
        {...register("reason", {
          required: "Reason required",
          minLength: {
            value: 10,
            message: "Reason must be 10+ characters",
          },
        })}
      />
      {errors.reason && <span className="error">{errors.reason.message}</span>}

      <select {...register("priority")}>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
      </select>

      <button type="submit">Create Request</button>
    </form>
  );
}
```

**2. Real-time Validation:**

```jsx
function PasswordInput({ value, onChange }) {
  const [strength, setStrength] = useState(0);

  useEffect(() => {
    // Calculate password strength
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[!@#$%^&*]/.test(value)) score++;

    setStrength(score);
  }, [value]);

  const strengthText = ["Weak", "Fair", "Good", "Strong", "Very Strong"];

  return (
    <>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className={`strength strength-${strength}`}>
        Strength: {strengthText[strength]}
      </div>
    </>
  );
}
```

**3. Date Validation:**

```jsx
function DateInput({ value, onChange, minDate = new Date() }) {
  const handleChange = (e) => {
    const date = new Date(e.target.value);

    if (date < minDate) {
      toast.error("Date cannot be in the past");
      return;
    }

    onChange(e.target.value);
  };

  const minDateStr = minDate.toISOString().split("T")[0];

  return (
    <input type="date" value={value} onChange={handleChange} min={minDateStr} />
  );
}
```

**4. Email Validation:**

```jsx
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return emailRegex.test(email);
}

// In form
<input
  type="email"
  {...register("email", {
    required: "Email required",
    validate: (email) => validateEmail(email) || "Invalid email",
  })}
/>;
```

**Frontend Validation Layers:**

1. HTML5 validation (type, required, min/max)
2. React Hook Form rules
3. Custom validation functions
4. Real-time feedback (strength, format)
5. API submission (server validation)

---

#### Q22: How do you handle loading states and spinners?

**Answer:**

```jsx
// components/LoadingSpinner.jsx
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full" />
      </div>
      <span className="ml-3 text-gray-600">Loading...</span>
    </div>
  );
}

// components/SkeletonLoader.jsx
export function SkeletonLoader() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
      ))}
    </div>
  );
}

// Usage in page
function RequestsPage() {
  const { requests, loading, error } = useRequests();

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error">{error}</div>;

  return <RequestTable requests={requests} />;
}

// Loading state in button
function SubmitButton({ loading, onClick }) {
  return (
    <button
      disabled={loading}
      onClick={onClick}
      className={loading ? "opacity-50 cursor-not-allowed" : ""}
    >
      {loading ? (
        <>
          <span className="animate-spin mr-2">⏳</span>
          Submitting...
        </>
      ) : (
        "Submit"
      )}
    </button>
  );
}
```

---

#### Q23: How do you optimize React components for performance?

**Answer:**

**1. Memoization:**

```jsx
import { memo, useMemo, useCallback } from "react";

// Prevent re-renders
const RequestCard = memo(function RequestCard({ request, onApprove }) {
  return (
    <div className="card">
      <h3>{request.itemName}</h3>
      <button onClick={() => onApprove(request.id)}>Approve</button>
    </div>
  );
});

// Dependency array
const RequestsPage = () => {
  const { requests } = useRequests();

  // Memoize callback
  const handleApprove = useCallback((id) => {
    approveRequest(id);
  }, []);

  // Memoize expensive computation
  const sortedRequests = useMemo(() => {
    return requests.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }, [requests]);

  return (
    <div>
      {sortedRequests.map((req) => (
        <RequestCard key={req.id} request={req} onApprove={handleApprove} />
      ))}
    </div>
  );
};
```

**2. Code Splitting:**

```jsx
import { lazy, Suspense } from "react";

const ApprovalPage = lazy(() => import("./pages/ApprovalPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));

function App() {
  return (
    <Routes>
      <Route
        path="/approvals"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <ApprovalPage />
          </Suspense>
        }
      />
    </Routes>
  );
}
```

**3. Virtual Lists (for large tables):**

```jsx
import { FixedSizeList } from "react-window";

function LargeRequestTable({ requests }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <div>{requests[index].itemName}</div>
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={requests.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

---

#### Q24: How do you structure component files?

**Answer:**

**Folder Structure:**

```
src/
├── components/
│   ├── RequestTable/
│   │   ├── index.jsx
│   │   ├── RequestTable.jsx
│   │   ├── RequestRow.jsx
│   │   ├── RequestTable.module.css
│   │   └── constants.js
│   │
│   ├── FilterBar/
│   │   ├── index.jsx
│   │   ├── FilterBar.jsx
│   │   └── FilterBar.module.css
│   │
│   └── LoadingSpinner.jsx
│
├── pages/
│   ├── DashboardPage.jsx
│   ├── RequestsPage.jsx
│   └── LoginPage.jsx
│
├── hooks/
│   ├── useRequests.js
│   └── useAuth.js
│
├── context/
│   └── AuthContext.jsx
│
├── api/
│   ├── axios.js
│   ├── auth.js
│   ├── requests.js
│   └── dashboard.js
│
├── utils/
│   └── index.js
│
└── constants/
    └── index.js
```

**Component File Example:**

```jsx
// components/RequestTable/RequestTable.jsx
import React from "react";
import styles from "./RequestTable.module.css";
import { RequestRow } from "./RequestRow";

/**
 * RequestTable Component
 * Displays a paginated table of purchase requests
 *
 * @param {Array} requests - List of request objects
 * @param {boolean} loading - Loading state
 * @param {Function} onApprove - Callback for approve action
 */
export function RequestTable({ requests, loading, onApprove }) {
  if (loading) return <div>Loading...</div>;
  if (requests.length === 0) return <EmptyState />;

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Item</th>
          <th>Quantity</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            onApprove={onApprove}
          />
        ))}
      </tbody>
    </table>
  );
}
```

**Export index.jsx:**

```jsx
// components/RequestTable/index.jsx
export { RequestTable } from "./RequestTable";
export { RequestRow } from "./RequestRow";
```

**Benefits:**

- Clear folder organization
- Easy to find components
- Encapsulated styles/logic
- Reusable index exports

---

#### Q25: How do you handle error boundaries in React?

**Answer:**

```jsx
// components/ErrorBoundary.jsx
import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <details style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>

          <button onClick={() => window.location.reload()}>Reload page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>;
```

---

#### Q26: How do you manage environment variables?

**Answer:**

**Frontend (.env):**

```
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your_client_id_here
```

**Backend (.env):**

```
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/mini_erp
DIRECT_URL=postgresql://user:password@localhost:5432/mini_erp
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
FRONTEND_URL=http://localhost:5173
```

**Usage Frontend:**

```jsx
const API_URL = import.meta.env.VITE_API_URL;

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
});
```

**Usage Backend:**

```typescript
export const serverConfig = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
};

export const authConfig = {
  jwtSecret: process.env.JWT_SECRET!,
  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  frontendUrl: process.env.FRONTEND_URL!,
};
```

---

#### Q27: How do you handle form submissions?

**Answer:**

```jsx
// pages/CreateRequestPage.jsx
import { useForm } from "react-hook-form";
import { createRequest } from "../api/requests";
import { toast } from "react-hot-toast";

export function CreateRequestPage() {
  const { register, handleSubmit, errors, reset, loading } = useForm();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (data) => {
    setSubmitting(true);

    try {
      // Validate date
      const requiredDate = new Date(data.requiredDate);
      if (requiredDate < new Date()) {
        throw new Error("Required date cannot be in the past");
      }

      // Submit to API
      const response = await createRequest({
        ...data,
        quantity: parseFloat(data.quantity),
        requiredDate: requiredDate.toISOString(),
      });

      // Success
      toast.success("Request created successfully!");
      reset(); // Clear form

      // Navigate or update list
      navigate("/requests");
    } catch (error) {
      toast.error(error.message || "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Item Name *</label>
        <input
          {...register("itemName", {
            required: "Item name is required",
          })}
        />
        {errors.itemName && (
          <span className="error">{errors.itemName.message}</span>
        )}
      </div>

      <div>
        <label>Quantity *</label>
        <input
          type="number"
          {...register("quantity", {
            required: "Quantity is required",
            min: { value: 0.1, message: "Must be > 0" },
          })}
        />
        {errors.quantity && (
          <span className="error">{errors.quantity.message}</span>
        )}
      </div>

      <div>
        <label>Required Date *</label>
        <input
          type="datetime-local"
          {...register("requiredDate", {
            required: "Required date is required",
          })}
        />
        {errors.requiredDate && (
          <span className="error">{errors.requiredDate.message}</span>
        )}
      </div>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "Creating..." : "Create Request"}
      </button>
    </form>
  );
}
```

---

#### Q28: What testing strategy would you use?

**Answer:**

**Unit Tests (Jest + React Testing Library):**

```typescript
// __tests__/auth.test.ts
import { registerUser, loginUser } from "../services/auth.service";
import bcryptjs from "bcryptjs";
import prisma from "../lib/prisma";

jest.mock("../lib/prisma");

describe("Auth Service", () => {
  it("should hash password before saving", async () => {
    const hashSpy = jest.spyOn(bcryptjs, "hash");

    await registerUser("test@example.com", "password123");

    expect(hashSpy).toHaveBeenCalledWith("password123", 10);
  });

  it("should throw error if email already exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "1" });

    await expect(
      registerUser("test@example.com", "password123"),
    ).rejects.toThrow("Email already registered");
  });
});
```

**Frontend Component Tests:**

```jsx
// __tests__/LoadingSpinner.test.jsx
import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "../components/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should render loading text", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
```

**Integration Tests:**

```typescript
// __tests__/integration/requests.test.ts
import request from "supertest";
import app from "../../server";

describe("Requests API", () => {
  it("should create a request", async () => {
    const response = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({
        itemName: "Laptop",
        quantity: 1,
        unit: "pcs",
        department: "IT",
        requiredDate: new Date().toISOString(),
        reason: "Team requirement",
        priority: "HIGH",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.request.status).toBe("DRAFT");
  });
});
```

---

---

## LOW PRIORITY Questions

#### Q29: How would you scale this application?

**Answer:**

**Horizontal Scaling:**

- Load balancer (nginx, AWS ELB)
- Multiple API server instances
- Session management (Redis)
- Separate database (managed service like AWS RDS)

**Caching:**

- Redis for frequently accessed data
- CDN for frontend assets
- API response caching

**Database Optimization:**

- Query optimization
- Read replicas for scaling reads
- Sharding for large datasets

---

#### Q30: How do you handle file uploads?

**Answer:**

**Future Enhancement - File Upload:**

```typescript
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if ([".pdf", ".doc", ".docx"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

router.post(
  "/requests/:id/attachments",
  upload.single("file"),
  async (req, res) => {
    // Save file reference to database
    const attachment = await prisma.attachment.create({
      data: {
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        requestId: req.params.id,
      },
    });

    res.json({ success: true, data: { attachment } });
  },
);
```

---

#### Q31: What monitoring and logging do you have?

**Answer:**

**Winston Logger:**

```typescript
import winston from "winston";
import dailyRotateFile from "winston-daily-rotate-file";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new dailyRotateFile({
      filename: "logs/application-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Usage
logger.info("Request created", {
  requestId: request.id,
  createdBy: user.id,
  correlationId: req.correlationId,
});

logger.error("Database error", {
  error: err.message,
  correlationId: req.correlationId,
});
```

---

#### Q32: How do you handle security concerns?

**Answer:**

**Security Measures:**

1. **SQL Injection Protection:**
   - Use Prisma parameterized queries ✓
   - Never concatenate strings in queries

2. **XSS Protection:**
   - HTTP-only cookies ✓
   - React escapes text content ✓

3. **CSRF Protection:**
   - SameSite cookie attribute ✓
   - CORS whitelist ✓

4. **Password Security:**
   - bcryptjs hashing ✓
   - 10 salt rounds ✓

5. **API Security:**
   - Authentication middleware ✓
   - Role-based access control ✓
   - Input validation with Zod ✓

6. **Rate Limiting (recommended):**

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
  message: "Too many requests",
});

app.use("/api/", limiter);
```

---

#### Q33: How would you add notifications?

**Answer:**

**Email Notifications:**

```typescript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendApprovalEmail = async (
  user: User,
  request: PurchaseRequest,
) => {
  await transporter.sendMail({
    from: "noreply@minierp.com",
    to: user.email,
    subject: `Your request for ${request.itemName} was approved!`,
    html: `
      <h2>Request Approved</h2>
      <p>Your purchase request has been approved.</p>
      <p><strong>Item:</strong> ${request.itemName}</p>
      <p><strong>Quantity:</strong> ${request.quantity} ${request.unit}</p>
    `,
  });
};

// Called on approval
await sendApprovalEmail(requester, request);
```

**In-App Notifications (React Hot Toast):**

```jsx
import toast from "react-hot-toast";

function ApproveButton({ requestId }) {
  const handleApprove = async () => {
    try {
      await approveRequest(requestId);
      toast.success("Request approved successfully");
    } catch (error) {
      toast.error("Failed to approve request");
    }
  };

  return <button onClick={handleApprove}>Approve</button>;
}
```

---

#### Q34: How do you handle date/time operations?

**Answer:**

**Backend (TypeScript):**

```typescript
// ISO 8601 format for storage
const requiredDate = new Date("2026-06-15T10:00:00Z");

// Query with date range
const requests = await prisma.purchaseRequest.findMany({
  where: {
    createdAt: {
      gte: new Date("2026-01-01"),
      lte: new Date("2026-12-31"),
    },
  },
});

// Format for response
const formatted = requiredDate.toISOString(); // "2026-06-15T10:00:00Z"
```

**Frontend (JavaScript):**

```javascript
// utils/index.js
export const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
  // "15 Jun 2026"
}

export const formatDateTime = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('en-IN')
}

// Usage in components
<span>{formatDate(request.createdAt)}</span>
<span>{formatDateTime(request.requiredDate)}</span>
```

---

#### Q35: What improvements would you make to this project?

**Answer:**

**Completed Features:**
✓ Role-based access control
✓ Complete audit trail
✓ Email/OAuth authentication
✓ CSV export
✓ Dashboard with statistics
✓ Request lifecycle management

**Recommended Improvements:**

**1. Real-time Updates (WebSocket):**

- Replace polling with WebSocket
- Instant status notifications
- Live dashboard updates

**2. Advanced Filtering:**

- Search by requester name
- Filter by date range
- Save filter presets

**3. Bulk Operations:**

- Batch approve/reject requests
- Bulk download CSV
- Batch status updates

**4. Analytics & Reports:**

- Department-wise spending
- Approval rate by manager
- Trend analysis
- Export reports

**5. File Attachments:**

- Upload supporting documents
- Store file metadata
- Download attachments

**6. Comments & Discussion:**

- Manager comments on requests
- Employee replies
- Discussion thread

**7. Mobile App:**

- React Native mobile app
- Push notifications
- Mobile-optimized UI

**8. Performance:**

- Database query caching with Redis
- API response pagination optimization
- Frontend code splitting

**9. Testing:**

- Unit tests for services
- Integration tests for API
- E2E tests for workflows

**10. Deployment:**

- Docker containerization
- Kubernetes orchestration
- CI/CD pipeline (GitHub Actions)

---

---

# Additional Interview Tips

## Common Follow-up Questions

**Q: How would you debug a production issue?**

- Check logs with correlation ID
- Monitor database performance
- Check API response times
- Review recent deployments
- Reproduce issue locally
- Use browser DevTools for frontend

**Q: How do you handle a database migration in production?**

- Backup database first
- Run migration on staging
- Test thoroughly
- Use backward-compatible migrations
- Roll out in off-peak hours
- Have rollback plan ready

**Q: How would you optimize database queries?**

- Add indexes to frequently filtered columns
- Use includes instead of separate queries
- Implement pagination
- Monitor slow queries
- Cache frequently accessed data
- Use database analyze tool

**Q: What's your approach to error handling?**

- Validate input with Zod
- Use custom AppError classes
- Log errors with context
- Return meaningful error messages
- Use global error handler
- Test error scenarios

**Q: How do you ensure code quality?**

- Write tests (unit/integration)
- Code review process
- ESLint for linting
- TypeScript for type safety
- Consistent naming conventions
- Documentation comments

---

# Expected Questions About Your Specific Project

1. **"What was the most challenging part?"**
   - Implementing role-based access control across frontend and backend
   - Designing audit logging system
   - State management across pages

2. **"How did you handle authentication?"**
   - JWT tokens + secure cookies
   - Google OAuth integration
   - Dual strategies for flexibility

3. **"Why Prisma over raw SQL?"**
   - Type safety
   - Automatic migrations
   - Better DX
   - Less boilerplate

4. **"How does data flow from frontend to backend?"**
   - User interaction → React state
   - Form submission → Axios POST
   - Backend validates with Zod
   - Prisma saves to database
   - Response returns to frontend

5. **"How do you ensure data security?"**
   - Password hashing (bcryptjs)
   - JWT authentication
   - Role-based authorization
   - Input validation
   - SQL injection prevention
   - XSS protection

---

# Practice Tips for Interview

1. **Study Your Own Code:**
   - Know every file intimately
   - Be ready to explain design decisions
   - Prepare for follow-ups

2. **Practice Explaining Architecture:**
   - Draw diagrams if possible
   - Explain data flow
   - Discuss trade-offs

3. **Be Ready for Variations:**
   - "What if we added X feature?"
   - "How would you optimize Y?"
   - "What's wrong with this code?"

4. **Demonstrate Problem Solving:**
   - Think aloud
   - Show your reasoning
   - Consider multiple approaches
   - Discuss trade-offs

5. **Prepare Examples:**
   - Have specific code snippets ready
   - Know how to explain complex parts
   - Be ready to live-code

---

# Good Luck! 🚀

Remember:

- Be honest about what you know and don't know
- Show enthusiasm for the project
- Demonstrate problem-solving ability
- Ask clarifying questions if needed
- Think before answering

---

**Document Version:** 1.0  
**Last Updated:** June 1, 2026  
**Total Questions:** 65+  
**Interview Difficulty:** Medium to High
