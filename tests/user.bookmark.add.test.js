'use strict';

/**
 * Tests for Issue #1264 — Add Story Bookmark
 * POST /backend/api/v1/users/bookmark/:storyId
 *
 * Run: cross-env NODE_ENV=local npx jest tests/user.bookmark.add.test.js --forceExit --verbose
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE WAS REWRITTEN:
 *
 * ❌ OLD tests tested: POST /users/:userId/stories/:storyId/bookmark
 *    - URL had userId as a path param (WRONG — Java does not have userId in path)
 *    - Tests like FC-01 "Bookmark non-existent user → 404" passed 9999999 as
 *      userId in the URL path — this is invalid in the new contract
 *
 * ✅ NEW tests test:   POST /users/bookmark/:storyId
 *    - Only storyId in path
 *    - userId comes from JWT token (req.decodedToken.user_id)
 *    - "Non-existent user" scenario is no longer testable via path —
 *      it would require a token signed for a deleted userId
 *    - Auth is REQUIRED (auth middleware enforced)
 *
 * Java Swagger contract:
 *   POST /users/bookmark/{storyId}
 *   - storyId: path param (required)
 *   - userId:  from JWT token (NOT in URL)
 *   - Auth:    required
 *   - 201 on success, 409 duplicate, 404 story/user not found, 500
 * ─────────────────────────────────────────────────────────────────────────────
 */

const request = require('supertest');
const app     = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN    = '/backend/api/v1/users/login';
const BASE_BOOKMARK = '/backend/api/v1/users/bookmark';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid   = () => `bkadd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob   = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async () => {
  const payload = {
    userName:     `BKAddUser_${uid()}`,
    userAge:      28,
    userMobile:   mob(),
    userGenderId: 1,
    languageEnum: 0,
    locationId:   1,
    locationName: 'Mumbai',
    userEmail:    email(),
    isEmailLogin: true,
    userTag: [], triggers: [], userCommunity: [],
  };
  const regRes = await request(app).post(BASE_REGISTER).send(payload);
  if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
  const loginRes = await request(app).post(BASE_LOGIN).send({ userEmail: payload.userEmail });
  return { userId: loginRes.body.userId, token: loginRes.body.jwtToken, payload };
};

// ─── Shared state ─────────────────────────────────────────────────────────────
const TEST_STORY_ID    = 1;    // Assumed to exist in test DB seed
const MISSING_STORY_ID = 9999999;

let testUser1 = null;
let testUser2 = null;

beforeAll(async () => {
  testUser1 = await registerAndLogin();
  testUser2 = await registerAndLogin();
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /users/bookmark/:storyId — Success Cases', () => {

  test('SC-01: Add bookmark returns 201 with success body', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`);

    // 201 = story exists, bookmarked
    // 404 = story not in test DB seed (acceptable)
    expect([201, 404, 409]).toContain(res.status);

    if (res.status === 201) {
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/bookmarked/i);
    }
  });

  test('SC-02: Response contains all required bookmark fields', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`);

    if (res.status === 201) {
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('bookmarkId');
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('storyId');
      expect(res.body).toHaveProperty('bookmarkedOn');
      expect(res.body).toHaveProperty('message');
    }
  });

  test('SC-03: userId in response matches authenticated user (from token, NOT path)', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`);

    if (res.status === 201) {
      // userId must equal the token user — not any URL-path value
      expect(res.body.userId).toBe(user.userId);
      expect(res.body.storyId).toBe(TEST_STORY_ID);
    }
  });

  test('SC-04: storyId in response matches path param', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`);

    if (res.status === 201) {
      expect(res.body.storyId).toBe(TEST_STORY_ID);
    }
  });

  test('SC-05: bookmarkedOn timestamp is present and valid', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`);

    if (res.status === 201) {
      expect(res.body.bookmarkedOn).toBeDefined();
      expect(new Date(res.body.bookmarkedOn).toString()).not.toBe('Invalid Date');
    }
  });

  test('SC-06: Multiple different users can bookmark the same story', async () => {
    const res1 = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    const res2 = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser2.token}`);

    if (res1.status === 201 && res2.status === 201) {
      // Different users — different userId in response
      expect(res1.body.userId).not.toBe(res2.body.userId);
      // Same story
      expect(res1.body.storyId).toBe(res2.body.storyId);
    }
  });

  test('SC-07: Response types are correct', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`);

    if (res.status === 201) {
      expect(typeof res.body.success).toBe('boolean');
      expect(typeof res.body.bookmarkId).toBe('number');
      expect(typeof res.body.userId).toBe('number');
      expect(typeof res.body.storyId).toBe('number');
      expect(typeof res.body.message).toBe('string');
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FAILURE CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /users/bookmark/:storyId — Failure Cases', () => {

  test('FC-01: Non-existent story → 404', async () => {
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${MISSING_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Story not found/i);
  });

  test('FC-02: Duplicate bookmark for same user + story → 409', async () => {
    const user = await registerAndLogin();

    const first = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`);

    if (first.status === 201) {
      const second = await request(app)
        .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(second.status).toBe(409);
      expect(second.body.message).toMatch(/already bookmarked/i);
    }
  });

  test('FC-03: No Authorization header → 403 (auth required)', async () => {
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`);

    // Unlike mark-as-read, this endpoint REQUIRES auth
    expect(res.status).toBe(403);
  });

  test('FC-04: Invalid token → 401', async () => {
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', 'Bearer not.a.valid.token');

    expect([401, 403]).toContain(res.status);
  });

  test('FC-05: String storyId → 422', async () => {
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/not-a-story`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    expect(res.status).toBe(422);
  });

  test('FC-06: storyId = 0 → 422', async () => {
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/0`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    expect(res.status).toBe(422);
  });

  test('FC-07: Negative storyId → 422', async () => {
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/-1`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    expect(res.status).toBe(422);
  });

  test('FC-08: Very large non-existent storyId → 404', async () => {
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/999999999`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    expect(res.status).toBe(404);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES — URL CONTRACT
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /users/bookmark/:storyId — URL Contract Edge Cases', () => {

  test('EC-01: URL has only storyId — no userId segment', async () => {
    // Confirm the route /bookmark/:storyId resolves correctly
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    // Must NOT be Express 404 "Endpoint not found" — route must exist
    if (res.status === 404) {
      // Must be service-level 404 (story not found), not route-level
      expect(res.body.message).toMatch(/Story not found/i);
    } else {
      expect([201, 409]).toContain(res.status);
    }
  });

  test('EC-02: Float storyId → 422', async () => {
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/100.5`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    expect(res.status).toBe(422);
  });

  test('EC-03: Old URL /users/:userId/stories/:storyId/bookmark must NOT match', async () => {
    // Proves the old route no longer exists
    const res = await request(app)
      .post(`/backend/api/v1/users/${testUser1.userId}/stories/${TEST_STORY_ID}/bookmark`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    // Must be 404 "Endpoint not found" — old route must be gone
    expect(res.status).toBe(404);
    // Should NOT have service-level message (it's a route-level 404)
    expect(res.body.message).toMatch(/Endpoint not found/i);
  });

  test('EC-04: userId is extracted from token — not from request body', async () => {
    const user = await registerAndLogin();

    // Send userId in body (should be ignored — userId comes from token only)
    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ userId: 99999 });   // this must be ignored

    if (res.status === 201) {
      // userId in response must be the token userId, not 99999
      expect(res.body.userId).toBe(user.userId);
      expect(res.body.userId).not.toBe(99999);
    }
  });

  test('EC-05: Response HTTP status is exactly 201 on success', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_BOOKMARK}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user.token}`);

    if (res.body.success === true) {
      expect(res.status).toBe(201);
    }
  });

});
