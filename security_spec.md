# Phase 0: Payload-First Security TDD Spec

## 1. Data Invariants
- **Public User Profile (`/users/{userId}/public/profile`)**:
  - The document `userId` must equal the path `{userId}`.
  - The profile can only be created by its own user, and `userId` field must match `request.auth.uid`.
  - Roles can only be initially assigned as default (e.g., `CASHIER`) and must NOT be escalated to `ADMIN` or `PLATFORM_OWNER` without admin credentials (not self-assigned).
  - The `createdAt` timestamp must match `request.time`.

- **Private PII User Info (`/users/{userId}/private/info`)**:
  - Readable and writable ONLY by the requesting user themselves (owner-access only). Other users cannot list or read this.
  - The `updatedAt` timestamp must match `request.time`.

- **Pharmacy Branches (`/branches/{branchId}`)**:
  - Creating, updating, or deleting branches requires platform admin role check or proper tenant authorization.
  - Unauthenticated users cannot read branch information.

- **Corporate Encrypted Backups (`/backups/{backupId}`)**:
  - Backups can only be created by authenticated users belonging to the corporate tenant.
  - The backup's `userId` field must exactly match `request.auth.uid`.
  - Backups are strictly immutable; once written, they cannot be updated or deleted.
  - A backup must belong to a valid tenant (non-empty ID).
  - The `createdAt` timestamp must be exactly equal to `request.time`.

---

## 2. The "Dirty Dozen" Payloads
Here are 12 specific payloads attempting to break our laws of Identity, Integrity, and State, which MUST return `PERMISSION_DENIED`:

### Payload 1: Spoofed Profile Owner
An attacker (`badActorUid`) attempts to write or overwrite another user's public profile document (`victimUid`) to hijack their identity representation.
```json
// Path: /users/victimUid/public/profile
{
  "userId": "badActorUid",
  "username": "hacker1337",
  "role": "CASHIER",
  "isActive": true,
  "createdAt": "server_timestamp"
}
```

### Payload 2: Self-Promotion (Privilege Escalation)
A regular cashier attempts to edit their profile status, elevating themselves directly to `PLATFORM_OWNER`.
```json
// Path: /users/myUid/public/profile
{
  "userId": "myUid",
  "username": "myUsername",
  "role": "PLATFORM_OWNER",
  "isActive": true,
  "createdAt": "server_timestamp"
}
```

### Payload 3: Spoofed Server Timestamp on Profile Creation
Creating a public profile with a client-side falsified historical timestamp to fake account age or bypass audit thresholds.
```json
// Path: /users/myUid/public/profile
{
  "userId": "myUid",
  "username": "myUsername",
  "role": "CASHIER",
  "isActive": true,
  "createdAt": "2020-01-01T00:00:00Z"
}
```

### Payload 4: PII Snoop (Cross-User Read)
An authenticated user attempts to pull the private PII contact details of a different target user profile.
```json
// Path: /users/victimUid/private/info
// Read request by user: badActorUid
```

### Payload 5: Rogue Branch Creation
An unauthenticated or regular unauthorized user attempts to register a new rogue pharmacy branch under an existing company.
```json
// Path: /branches/branch777
{
  "id": "branch777",
  "code": "ROGUE",
  "name": "Rogue Branch",
  "location": "Underground Market",
  "isActive": true,
  "tenantId": "tenantXYZ",
  "createdAt": "server_timestamp"
}
```

### Payload 6: Rogue Backup Splicing (Impersonating Owner)
An authenticated user `attackerUid` uploads an encrypted backup under a different owner `victimUid` in order to contaminate the ledger of another node.
```json
// Path: /backups/backup999
{
  "id": "backup999",
  "tenantId": "tenantXYZ",
  "userId": "victimUid",
  "filename": "pharma_backup_2026.enc",
  "payload": "ENC_SHADOW_DATA",
  "size": 1024,
  "createdAt": "server_timestamp"
}
```

### Payload 7: Backup Mutation/Update Attempt
An attacker tries to modify a completed encrypted transaction backup on the cloud to execute state-shortcut manipulation.
```json
// Path: /backups/backup999
// Update request: change payload to falsified logs
{
  "payload": "MALICIOUS_LEDGER_DATA_ALTERED"
}
```

### Payload 8: Backup Deletion Attempt
A rogue actor tries to delete the audit trial backups on Firestore to cover up system theft or inventory fraud.
```json
// Path: /backups/backup999
// Delete request by: attackerUid
```

### Payload 9: Denial-of-Wallet ID Injection
A malicious actor tries to write a branch document with a massive 1MB string containing arbitrary characters as the document ID to cause storage cost explosion.
```json
// Path: /branches/A_Veeeeeeery_Looooooooong_ID_Over_128_Characters_That_Saturates_Indices...
```

### Payload 10: Value Poisoning (Malicious Types)
An attacker tries to write a float/boolean value to a text-field property like `username` or a 1MB string to a short boolean property like `isActive`.
```json
// Path: /users/myUid/public/profile
{
  "userId": "myUid",
  "username": true,
  "role": "CASHIER",
  "isActive": "A_VERY_LONG_STRING_THAT_NEVER_ENDS_...",
  "createdAt": "server_timestamp"
}
```

### Payload 11: Missing Required Fields in Branch Registry
Attempting to create a branch document omitting the mandatory `tenantId` field to cause index failure and sync orphaned branch registries.
```json
// Path: /branches/branch123
{
  "id": "branch123",
  "code": "BR1",
  "name": "Main Pharmacy",
  "location": "Riyadh",
  "isActive": true,
  "createdAt": "server_timestamp"
}
```

### Payload 12: Email Spoofing Attack Without Verification
A user signs up with a mock user profile and attempts to perform administrative mutations using an unverified email address bypassing secure sign-in check rules.
```json
// auth.token.email = admin@pharmaflow.com
// auth.token.email_verified = false
```

---

## 3. The Test Runner Config Reference
Our actual test files run against these targets to guarantee security rules return `PERMISSION_DENIED`.
