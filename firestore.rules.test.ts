import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(new URL('./firebase-blueprint.json', import.meta.url), 'utf8'));

test('firestore.rules starts with default-deny catch-all safety net', () => {
  assert.match(rulesContent, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('all blueprint collections have explicit match blocks in firestore.rules', () => {
  const expectedMatches = [
    'match /users/{userId}',
    'match /tasks/{taskId}',
    'match /habits/{habitId}',
    'match /expenses/{expenseId}',
    'match /sharedProfiles/{profileId}',
    'match /shareInvites/{inviteCode}',
    'match /calendarEvents/{eventId}',
  ];
  for (const m of expectedMatches) {
    assert.ok(rulesContent.includes(m), `Missing rule block for ${m}`);
  }
  assert.equal(Object.keys(blueprint.firestore).length, 7);
});

test('PII isolation blocks listing /users and requires email_verified on writes', () => {
  assert.match(rulesContent, /match \/users\/\{userId\}[\s\S]*?allow list: if false;/);
  assert.ok(rulesContent.includes('request.auth.token.email_verified == true'));
});

test('connected family viewers have strictly read-only access and cannot edit owner records', () => {
  assert.ok(rulesContent.includes('request.auth.uid in resource.data.viewerIds'));
  assert.ok(rulesContent.includes('match /sharedProfiles/{profileId}'));
  assert.ok(rulesContent.includes("existing().status == 'open'"));
  assert.ok(rulesContent.includes("incoming().status == 'accepted'"));
  assert.ok(rulesContent.includes('existing().creatorId != request.auth.uid'));
});

test('dirty dozen payload invariants: strict key allowlists and bounded arrays exist', () => {
  assert.ok(rulesContent.includes('isBoundedStringList(data.completedDates, 366)'));
  assert.ok(rulesContent.includes('isBoundedStringList(data.graceDates, 60)'));
  assert.ok(rulesContent.includes('isBoundedIntList(data.claimedMilestones, 10)'));
  assert.ok(rulesContent.includes('isBoundedStringList(data.expenseCategories, 30)'));
  assert.ok(rulesContent.includes('data.budgetLimits is map && data.budgetLimits.size() <= 30'));
  assert.ok(rulesContent.includes('isBoundedStringList(data.viewerIds, 25)'));
  assert.ok(rulesContent.includes('data.amount is number && data.amount > 0 && data.amount <= 1000000'));
  assert.ok(rulesContent.includes('incoming().createdAt == request.time'));
  assert.ok(rulesContent.includes('incoming().updatedAt == request.time'));
});
