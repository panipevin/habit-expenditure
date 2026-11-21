# Cadence Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Private User Isolation (PII & Finances)**: `/users/{userId}` and its subcollections (`tasks`, `habits`, `expenses`) are strictly readable and writable only by the verified owner (`request.auth.uid == userId`). No user can read or list another user's profile, email, daily tasks, habits, or expenses.
2. **Board Membership Master Gate**: Every item under `/boards/{boardId}/items/{itemId}` and comment under `/boards/{boardId}/comments/{commentId}` requires synchronous parent board verification (`request.auth.uid in get(/databases/$(database)/documents/boards/$(boardId)).data.memberIds`). Revoking a member from the board immediately revokes all item and comment access.
3. **Immutable Ownership & Timestamps**: `ownerId`, `creatorId`, `authorId`, `boardId`, and `createdAt` are immutable after document creation. `createdAt` must equal `request.time` on create, and `updatedAt` must equal `request.time` on update.
4. **Bounded Volumetric Limits**: Every string field has a strict `.size()` upper bound matching `firebase-blueprint.json`; every array (`memberIds <= 25`, `participantIds <= 25`, `completedDates <= 366`, `graceDates <= 60`, `claimedMilestones <= 10`) is strictly bounded with element type checks.
5. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Task Create**: Adding `isAdmin: true` to `/users/{uid}/tasks/{id}` -> Rejected by `hasOnly(...)`.
2. **Cross-User Expense Read**: User B calling `get` on `/users/{userA}/expenses/{id}` -> Rejected by `isOwner(userId)`.
3. **Unverified Email Write**: Token with `email_verified: false` writing a task -> Rejected by `isVerified()`.
4. **ID Poisoning**: Creating `/users/{uid}/tasks/<150-char-invalid-id>` -> Rejected by `isValidId(taskId)`.
5. **Timestamp Forgery**: Setting `createdAt` to a client-chosen past timestamp -> Rejected by `incoming().createdAt == request.time`.
6. **Owner Spoofing**: Creating a task with `ownerId: "victim-uid"` -> Rejected by `data.ownerId == request.auth.uid`.
7. **Orphaned Board Item**: Creating `/boards/nonexistent/items/item1` -> Rejected by Master Gate `exists()` + `get()`.
8. **Revoked Member Board Write**: Removed user trying to update `/boards/{boardId}/items/{itemId}` -> Rejected by Master Gate membership lookup.
9. **Oversized Array Attack**: Writing 500 entries into `habit.completedDates` -> Rejected by `data.completedDates.size() <= 366`.
10. **Value Poisoning on Update**: Updating `expense.amount` to `-500` or a string `"999"` -> Rejected by `isValidExpense(incoming())`.
11. **Terminal/Immutable Tampering**: Updating `boardId` or `createdAt` on an existing board item -> Rejected by `affectedKeys().hasOnly(...)` and immutability checks.
12. **Blanket Collection Scraping**: Listing `/users` or `/calendarEvents` without ownership/participation match -> Rejected (`allow list: if false` on `/users`, and `resource.data` enforcement on `/calendarEvents`).
