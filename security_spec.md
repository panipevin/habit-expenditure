# Cadence Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict PII Isolation (`/users/{userId}`)**: Private account details (`email`, `biometricEnabled`, `eveningCutoffHour`, `theme`) live exclusively under `/users/{userId}` and are strictly readable and writable only by `request.auth.uid == userId` (`allow list: if false`). Connected family viewers NEVER gain access to another user's private profile or email.
2. **Owner-Only Writes, Connected Viewer Read-Only Access**: Every user's `/users/{userId}/tasks`, `/habits`, `/expenses`, `/sharedProfiles/{userId}`, and `/calendarEvents` can ONLY be created, updated, or deleted by the verified owner (`request.auth.uid == ownerId`). Connected family members whose UID is explicitly listed by the owner in `viewerIds` (or `participantIds` for calendar events) can read and list those records in strict read-only mode.
3. **Single-Use Terminal Invite Locking (`/shareInvites/{inviteCode}`)**: Invite codes are generated with `status == 'open'` and can be accepted once by a verified user other than the creator. Once `status == 'accepted'`, the invite is terminally locked against further updates. Listing `/shareInvites` is strictly limited to invites the signed-in user created or accepted.
4. **Immutable Ownership & Server Timestamps**: `ownerId`, `creatorId`, `uid`, `code`, and `createdAt` are immutable after creation. `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **Bounded Volumetric Limits**: Every string field enforces `.size()` limits matching `firebase-blueprint.json` (including custom `expense.category` 1–40 chars); every array and map (`viewerIds <= 25`, `viewerNames <= 25`, `participantIds <= 25`, `completedDates <= 366`, `graceDates <= 60`, `claimedMilestones <= 10`, `expenseCategories <= 30`, `budgetLimits <= 30`) is strictly bounded.
6. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection**: Adding `isAdmin: true` to `/users/{uid}/tasks/{id}` or `/sharedProfiles/{uid}` -> Rejected by `hasOnly(...)`.
2. **Connected Viewer Editing Owner's Expense**: Sister (listed in `viewerIds`) attempting `update` or `delete` on `/users/{brotherUid}/expenses/{id}` -> Rejected by `isOwner(userId)`.
3. **Connected Viewer Reading Private Account PII**: Sister attempting `get` on `/users/{brotherUid}` -> Rejected by `isOwner(userId)` (only non-PII `/sharedProfiles/{brotherUid}` is readable).
4. **Stranger Reading Private Expense**: Unconnected User C attempting `get` or `list` on `/users/{brotherUid}/expenses` -> Rejected because `request.auth.uid` is not `ownerId` and not in `viewerIds`.
5. **Unverified Email Write**: Token with `email_verified: false` creating a task or accepting an invite -> Rejected by `isVerified()`.
6. **ID Poisoning**: Creating `/users/{uid}/tasks/<150-char-invalid-id>` -> Rejected by `isValidId(taskId)`.
7. **Timestamp Forgery**: Setting `createdAt` to a client-chosen past timestamp -> Rejected by `incoming().createdAt == request.time`.
8. **Owner Spoofing**: Creating an expense or sharedProfile with `ownerId: "victim-uid"` -> Rejected by `data.ownerId == request.auth.uid`.
9. **Hijacking an Accepted Invite**: User C attempting to overwrite `acceptedByUid` on an already-accepted `/shareInvites/{code}` -> Rejected by `existing().status == 'open'`.
10. **Self-Accepting Own Invite**: Creator attempting to set `acceptedByUid == creatorId` on `/shareInvites/{code}` -> Rejected by `existing().creatorId != request.auth.uid`.
11. **Value Poisoning & Oversized Arrays**: Setting `expense.amount` to `-500`, `expense.category` to 80 chars, or `viewerIds` to 50 entries -> Rejected by `isValidExpense(incoming())` / `isBoundedStringList(..., 25)`.
12. **Blanket Collection Scraping**: Listing `/users`, `/shareInvites`, `/sharedProfiles`, or `/calendarEvents` without ownership/viewer match -> Rejected (`allow list: if false` on `/users`, and `resource.data` enforcement on all other collections).
