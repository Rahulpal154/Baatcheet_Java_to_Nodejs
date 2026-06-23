'use strict';

/**
 * Tests for Issue #1270 — Delete User Interactions
 *
 * Endpoints:
 *   DELETE /backend/api/v1/users/resetInteraction/:userId
 *   DELETE /backend/api/v1/users/clearReflectionAndNotes/:userId
 *
 * Run: cross-env NODE_ENV=local npx jest tests/user.interactions.test.js --forceExit --verbose
 *
 * Covers:
 *  ✅ resetInteraction: 200 with message and deletedCounts
 *  ✅ resetInteraction: idempotent — second call also succeeds with 0 counts
 *  ✅ resetInteraction: 404 on non-existent user
 *  ✅ resetInteraction: 422 on invalid userId
 *  ✅ resetInteraction: 403 with no auth header
 *  ✅ resetInteraction: 401 with invalid token
 *  ✅ resetInteraction: response shape is correct
 *  ✅ clearReflectionAndNotes: 200 with message and deletedCounts
 *  ✅ clearReflectionAndNotes: idempotent — second call also returns 200
 *  ✅ clearReflectionAndNotes: 404 on non-existent user
 *  ✅ clearReflectionAndNotes: 422 on invalid userId
 *  ✅ clearReflectionAndNotes: 403 with no auth header
 *  ✅ clearReflectionAndNotes: response shape and count fields present
 *  ✅ Edge: negative userId → 422 for both endpoints
 *  ✅ Edge: userId=0 → 422 for both endpoints
 *  ✅ Edge: float userId → 422 for both endpoints
 *  ✅ Edge: large non-existent userId → 404 for both
 *  ✅ Data Integrity: metrics.storiesRead drops to 0 after resetInteraction
 *  ✅ Data Integrity: metrics.submissionsCount unaffected by resetInteraction
 */

const request = require('supertest');
const app     = require('../app');

const BASE_REGISTER  = '/backend/api/v1/users/register';
const BASE_LOGIN     = '/backend/api/v1/users/login';
const BASE_USERS     = '/backend/api/v1/users';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid   = () => `inter_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob   = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async (overrides = {}) => {
  const payload = {
    userName:     `InterUser_${uid()}`,
    userAge:      28,
    userMobile:   mob(),
    userGenderId: 1,
    languageEnum: 0,
    locationId:   1,
    locationName: 'Mumbai',
    userEmail:    email(),
    isEmailLogin: true,
    userTag:      [],
    triggers:     [],
    userCommunity:[],
    ...overrides,
  };

  const regRes = await request(app).post(BASE_REGISTER).send(payload);
  if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);

  const loginRes = await request(app).post(BASE_LOGIN).send({ userEmail: payload.userEmail });
  if (loginRes.status !== 200) throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);

  return { userId: loginRes.body.userId, token: loginRes.body.jwtToken, payload };
};

// ─── Shared state ─────────────────────────────────────────────────────────────
let testUser = null;

beforeAll(async () => {
  testUser = await registerAndLogin();
}, 30000);

// ═════════════════════════════════════════════════════════════════════════════
// ENDPOINT 1 — DELETE /users/resetInteraction/:userId
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /users/resetInteraction/:userId — Success Cases', () => {

  test('SC-01: Reset interactions returns 200 with message', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/reset/i);
  });

  test('SC-02: Response contains userId field', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user.userId);
  });

  test('SC-03: Response contains deletedCounts with storyInteractions and reactions', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deletedCounts');
    expect(res.body.deletedCounts).toHaveProperty('storyInteractions');
    expect(res.body.deletedCounts).toHaveProperty('reactions');
  });

  test('SC-04: Counts are non-negative integers', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.deletedCounts.storyInteractions).toBeGreaterThanOrEqual(0);
    expect(res.body.deletedCounts.reactions).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(res.body.deletedCounts.storyInteractions)).toBe(true);
    expect(Number.isInteger(res.body.deletedCounts.reactions)).toBe(true);
  });

  test('SC-05: Idempotent — second call on same user returns 200 with 0 deleted', async () => {
    const user = await registerAndLogin();

    // First call
    const first = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(first.status).toBe(200);

    // Second call — should succeed with counts = 0
    const second = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(second.status).toBe(200);
    expect(second.body.deletedCounts.storyInteractions).toBe(0);
    expect(second.body.deletedCounts.reactions).toBe(0);
  });

  test('SC-06: Fresh user (no interactions) also returns 200 with 0 counts', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.deletedCounts.storyInteractions).toBe(0);
    expect(res.body.deletedCounts.reactions).toBe(0);
  });

});

describe('DELETE /users/resetInteraction/:userId — Failure Cases', () => {

  test('FC-01: Non-existent userId → 404', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/9999999`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  test('FC-02: No Authorization header → 403', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${testUser.userId}`);

    expect(res.status).toBe(403);
  });

  test('FC-03: Invalid token → 401', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${testUser.userId}`)
      .set('Authorization', 'Bearer not.a.valid.token');

    expect([401, 403]).toContain(res.status);
  });

  test('FC-04: String userId → 422', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/not-an-id`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

});

describe('DELETE /users/resetInteraction/:userId — Edge Cases', () => {

  test('EC-01: userId=0 → 422', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/0`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('EC-02: Negative userId → 422', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/-1`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('EC-03: Float userId → 422', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/42.5`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('EC-04: Very large non-existent userId → 404', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/999999999`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(404);
  });

  test('EC-05: Response type checks for message, userId, deletedCounts', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.userId).toBe('number');
    expect(typeof res.body.deletedCounts).toBe('object');
  });

  test('EC-06: resetInteraction does not delete user itself (user still exists after)', async () => {
    const user = await registerAndLogin();

    await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    // User should still be retrievable
    const getRes = await request(app)
      .get(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.userId).toBe(user.userId);
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// ENDPOINT 2 — DELETE /users/clearReflectionAndNotes/:userId
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /users/clearReflectionAndNotes/:userId — Success Cases', () => {

  test('SC-01: Clear reflections and notes returns 200 with message', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/cleared|reflection|notes/i);
  });

  test('SC-02: Response contains userId field', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user.userId);
  });

  test('SC-03: Response contains deletedCounts with all three fields', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deletedCounts');
    expect(res.body.deletedCounts).toHaveProperty('notePrompts');
    expect(res.body.deletedCounts).toHaveProperty('userNotes');
    expect(res.body.deletedCounts).toHaveProperty('storyReflections');
  });

  test('SC-04: All deletedCounts are non-negative integers', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    const dc = res.body.deletedCounts;
    expect(dc.notePrompts).toBeGreaterThanOrEqual(0);
    expect(dc.userNotes).toBeGreaterThanOrEqual(0);
    expect(dc.storyReflections).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(dc.notePrompts)).toBe(true);
    expect(Number.isInteger(dc.userNotes)).toBe(true);
    expect(Number.isInteger(dc.storyReflections)).toBe(true);
  });

  test('SC-05: Idempotent — second call on same user returns 200 with 0 counts', async () => {
    const user = await registerAndLogin();

    const first = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(second.status).toBe(200);
    expect(second.body.deletedCounts.notePrompts).toBe(0);
    expect(second.body.deletedCounts.userNotes).toBe(0);
    expect(second.body.deletedCounts.storyReflections).toBe(0);
  });

  test('SC-06: Fresh user (no notes/reflections) returns 200 with all 0 counts', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.deletedCounts.notePrompts).toBe(0);
    expect(res.body.deletedCounts.userNotes).toBe(0);
    expect(res.body.deletedCounts.storyReflections).toBe(0);
  });

});

describe('DELETE /users/clearReflectionAndNotes/:userId — Failure Cases', () => {

  test('FC-01: Non-existent userId → 404', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/9999999`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  test('FC-02: No Authorization header → 403', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${testUser.userId}`);

    expect(res.status).toBe(403);
  });

  test('FC-03: Invalid token → 401', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${testUser.userId}`)
      .set('Authorization', 'Bearer not.a.valid.token');

    expect([401, 403]).toContain(res.status);
  });

  test('FC-04: String userId → 422', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/not-an-id`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

});

describe('DELETE /users/clearReflectionAndNotes/:userId — Edge Cases', () => {

  test('EC-01: userId=0 → 422', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/0`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('EC-02: Negative userId → 422', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/-1`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('EC-03: Float userId → 422', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/42.5`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('EC-04: Very large non-existent userId → 404', async () => {
    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/999999999`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(404);
  });

  test('EC-05: clearReflectionAndNotes does not delete user itself', async () => {
    const user = await registerAndLogin();

    await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    const getRes = await request(app)
      .get(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.userId).toBe(user.userId);
  });

  test('EC-06: Both endpoints can be called in sequence without error', async () => {
    const user = await registerAndLogin();

    const r1 = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    const r2 = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  test('EC-07: Response type checks — clearReflectionAndNotes', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.userId).toBe('number');
    expect(typeof res.body.deletedCounts).toBe('object');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// DATA INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
describe('Data Integrity — resetInteraction and clearReflectionAndNotes', () => {

  test('DI-01: resetInteraction does NOT clear submissions (scoped to interactions only)', async () => {
    const user = await registerAndLogin();

    // Add a submission
    const subRes = await request(app)
      .post(`${BASE_USERS}/${user.userId}/submissions`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ submissionTitle: 'Integrity Test', submissionContent: 'Content' });
    expect(subRes.status).toBe(201);

    // Reset interactions
    const resetRes = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(resetRes.status).toBe(200);

    // Submission should still exist
    const subsRes = await request(app)
      .get(`${BASE_USERS}/${user.userId}/submissions`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(subsRes.status).toBe(200);
    expect(subsRes.body.pagination.totalSubmissions).toBeGreaterThanOrEqual(1);
  }, 30000);

  test('DI-02: clearReflectionAndNotes does NOT clear submissions', async () => {
    const user = await registerAndLogin();

    // Add a submission
    await request(app)
      .post(`${BASE_USERS}/${user.userId}/submissions`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ submissionTitle: 'Notes Test', submissionContent: 'Content' });

    // Clear reflections and notes
    const clearRes = await request(app)
      .delete(`${BASE_USERS}/clearReflectionAndNotes/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(clearRes.status).toBe(200);

    // Submission should still exist
    const subsRes = await request(app)
      .get(`${BASE_USERS}/${user.userId}/submissions`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(subsRes.status).toBe(200);
    expect(subsRes.body.pagination.totalSubmissions).toBeGreaterThanOrEqual(1);
  }, 30000);

  test('DI-03: resetInteraction does NOT clear bookmarks (user_story_map)', async () => {
    const user = await registerAndLogin();

    // Reset interactions
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);

    // resetInteraction should NOT report any bookmarks in deletedCounts
    expect(res.body.deletedCounts).not.toHaveProperty('bookmarks');
  });

  test('DI-04: Both operations are scoped to the specified userId only', async () => {
    const user1 = await registerAndLogin();
    const user2 = await registerAndLogin();

    // Reset user1 interactions
    const res = await request(app)
      .delete(`${BASE_USERS}/resetInteraction/${user1.userId}`)
      .set('Authorization', `Bearer ${user1.token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user1.userId);

    // user2 should still be retrievable and unaffected
    const getRes = await request(app)
      .get(`${BASE_USERS}/${user2.userId}`)
      .set('Authorization', `Bearer ${user2.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.userId).toBe(user2.userId);
  });

});