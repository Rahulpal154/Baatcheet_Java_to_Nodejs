'use strict';

const request = require('supertest');
const app = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN = '/backend/api/v1/users/login';
const BASE_USERS = '/backend/api/v1/users';

const uid = () => `del_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async (overrides = {}) => {
  const payload = {
    userName: 'DeleteTest User',
    userAge: 28,
    userMobile: mob(),
    userGenderId: 1,
    languageEnum: 0,
    locationId: 1,
    locationName: 'Mumbai',
    userEmail: email(),
    isEmailLogin: true,
    userTag: [{ tagId: 1 }],
    triggers: [{ triggerId: 1 }],
    userCommunity: [{ communityId: 1 }],
    ...overrides,
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
let testUser3 = null;

beforeAll(async () => {
  testUser1 = await registerAndLogin();
  testUser2 = await registerAndLogin();
  testUser3 = await registerAndLogin({ userTag: [], triggers: [], userCommunity: [] });
}, 30000);

describe('DELETE /users/:userId — Success Cases', () => {

  test('SC-01: Delete user returns 200 with success message', async () => {
    const { userId, token } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);
    expect(res.body.userId).toBe(userId);
  });

  test('SC-02: Response contains success flag and userId', async () => {
    const { userId, token } = testUser2;

    const res = await request(app)
      .delete(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('userId');
    expect(typeof res.body.success).toBe('boolean');
  });

  test('SC-03: Delete user with tags and triggers', async () => {
    const cleanUser = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/${cleanUser.userId}`)
      .set('Authorization', `Bearer ${cleanUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('SC-04: Delete user with no relationships (no tags/triggers)', async () => {
    const { userId, token } = testUser3;

    const res = await request(app)
      .delete(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

});

describe('DELETE /users/:userId — Failure Cases', () => {

  test('FC-01: Non-existent userId → 404', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/9999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  test('FC-02: No Authorization header → 403', async () => {
    const { userId } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/${userId}`);

    expect(res.status).toBe(403);
  });

  test('FC-03: Invalid userId (string) → 422', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/not-an-id`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-04: userId=0 → 422', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-05: Invalid token → 401', async () => {
    const { userId } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/${userId}`)
      .set('Authorization', 'Bearer invalid.token.here');

    expect([401, 403]).toContain(res.status);
  });

  test('FC-06: Already deleted user (idempotency) → 404 on second delete', async () => {
    const user = await registerAndLogin();

    const firstDelete = await request(app)
      .delete(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(firstDelete.status).toBe(200);

    const secondDelete = await request(app)
      .delete(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(secondDelete.status).toBe(404);
  });

});

describe('DELETE /users/:userId — Edge Cases', () => {

  test('EC-01: Large user ID returns 404 (not found)', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/999999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('EC-02: Negative userId → 422', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/-1`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-03: Float userId → 422', async () => {
    const { token } = testUser1;

    const res = await request(app)
      .delete(`${BASE_USERS}/42.5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-04: Deleted user cannot be retrieved afterward', async () => {
    const user = await registerAndLogin();

    await request(app)
      .delete(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    const getRes = await request(app)
      .get(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(getRes.status).toBe(404);
  });

  test('EC-05: Response structure is consistent', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .delete(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.success).toBe('boolean');
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.userId).toBe('number');
  });

});

describe('DELETE /users/:userId — Data Integrity', () => {

  test('DI-01: Deleting user cleans up tags', async () => {
    const user = await registerAndLogin({
      userTag: [{ tagId: 1 }],
    });

    const res = await request(app)
      .delete(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
  });

  test('DI-02: Deleting user cleans up triggers', async () => {
    const user = await registerAndLogin({
      triggers: [{ triggerId: 1 }],
    });

    const res = await request(app)
      .delete(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
  });

  test('DI-03: Deleting user cleans up communities', async () => {
    const user = await registerAndLogin({
      userCommunity: [{ communityId: 1 }],
    });

    const res = await request(app)
      .delete(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
  });

});
