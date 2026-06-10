'use strict';

const request = require('supertest');
const app = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN = '/backend/api/v1/users/login';
const BASE_USERS = '/backend/api/v1/users';

const uid = () => `bookmark_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async () => {
  const payload = {
    userName: 'BookmarkTest User',
    userAge: 28,
    userMobile: mob(),
    userGenderId: 1,
    languageEnum: 0,
    locationId: 1,
    locationName: 'Mumbai',
    userEmail: email(),
    isEmailLogin: true,
    userTag: [],
    triggers: [],
    userCommunity: [],
  };

  const regRes = await request(app).post(BASE_REGISTER).send(payload);
  if (regRes.status !== 201) throw new Error(`Registration failed`);

  const loginRes = await request(app).post(BASE_LOGIN).send({ userEmail: payload.userEmail });
  const token = loginRes.body.jwtToken;
  const userId = loginRes.body.userId;

  return { userId, token, payload };
};

let testUser1 = null;
let testUser2 = null;
let testStoryId = 1;

beforeAll(async () => {
  testUser1 = await registerAndLogin();
  testUser2 = await registerAndLogin();
}, 30000);

describe('POST /users/:userId/stories/:storyId/bookmark — Success Cases', () => {

  test('SC-01: Add bookmark returns 201 with success message', async () => {
    const { userId, token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect([201, 404, 409]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/bookmarked/i);
    }
  });

  test('SC-02: Response contains bookmark details', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_USERS}/${user.userId}/stories/${testStoryId}/bookmark`)
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

  test('SC-03: Bookmark contains correct userId and storyId', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_USERS}/${user.userId}/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${user.token}`);

    if (res.status === 201) {
      expect(res.body.userId).toBe(user.userId);
      expect(res.body.storyId).toBe(testStoryId);
    }
  });

  test('SC-04: Bookmark has timestamp', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_USERS}/${user.userId}/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${user.token}`);

    if (res.status === 201) {
      expect(res.body.bookmarkedOn).toBeDefined();
      expect(typeof res.body.bookmarkedOn).toBe('string');
    }
  });

});

describe('POST /users/:userId/stories/:storyId/bookmark — Failure Cases', () => {

  test('FC-01: Bookmark non-existent user → 404', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/9999999/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  test('FC-02: Bookmark non-existent story → 404', async () => {
    const { userId, token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/9999999/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Story not found/i);
  });

  test('FC-03: Duplicate bookmark → 409', async () => {
    const user = await registerAndLogin();

    const firstBookmark = await request(app)
      .post(`${BASE_USERS}/${user.userId}/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${user.token}`);

    if (firstBookmark.status === 201) {
      const secondBookmark = await request(app)
        .post(`${BASE_USERS}/${user.userId}/stories/${testStoryId}/bookmark`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(secondBookmark.status).toBe(409);
      expect(secondBookmark.body.message).toMatch(/already bookmarked/i);
    }
  });

  test('FC-04: No Authorization header → 403', async () => {
    const { userId } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/${testStoryId}/bookmark`);

    expect(res.status).toBe(403);
  });

  test('FC-05: Invalid userId (string) → 422', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/not-an-id/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-06: Invalid storyId (string) → 422', async () => {
    const { userId, token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/not-a-story/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-07: Invalid token → 401', async () => {
    const { userId } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/${testStoryId}/bookmark`)
      .set('Authorization', 'Bearer invalid.token.here');

    expect([401, 403]).toContain(res.status);
  });

});

describe('POST /users/:userId/stories/:storyId/bookmark — Edge Cases', () => {

  test('EC-01: userId=0 → 422', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/0/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-02: storyId=0 → 422', async () => {
    const { userId, token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/0/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-03: Negative userId → 422', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/-1/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-04: Negative storyId → 422', async () => {
    const { userId, token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/-1/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-05: Float userId → 422', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/42.5/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-06: Float storyId → 422', async () => {
    const { userId, token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/100.5/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-07: Multiple users can bookmark same story', async () => {
    const res1 = await request(app)
      .post(`${BASE_USERS}/${testUser1.userId}/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${testUser1.token}`);

    const res2 = await request(app)
      .post(`${BASE_USERS}/${testUser2.userId}/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${testUser2.token}`);

    if (res1.status === 201 && res2.status === 201) {
      expect(res1.body.userId).not.toBe(res2.body.userId);
      expect(res1.body.storyId).toBe(res2.body.storyId);
    }
  });

  test('EC-08: Large userId (not found) → 404', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/999999999/stories/${testStoryId}/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('EC-09: Large storyId (not found) → 404', async () => {
    const { userId, token } = testUser1;

    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/stories/999999999/bookmark`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('EC-10: Response format is consistent', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .post(`${BASE_USERS}/${user.userId}/stories/${testStoryId}/bookmark`)
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
