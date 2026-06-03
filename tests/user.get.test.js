'use strict';

const request = require('supertest');
const app = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN = '/backend/api/v1/users/login';
const BASE_USERS = '/backend/api/v1/users';

const uid = () => `get_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async (overrides = {}) => {
  const payload = {
    userName: 'GetTest User',
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

let testUser = null;

beforeAll(async () => {
  testUser = await registerAndLogin();
}, 30000);

describe('GET /users/:userId — Success Cases', () => {

  test('SC-01: Get user profile — basic fields returned', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userId);
    expect(res.body.userName).toBe('GetTest User');
    expect(res.body.userAge).toBe(28);
    expect(res.body.userEmail).toBe(testUser.payload.userEmail);
  });

  test('SC-02: Response contains all required fields', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('userName');
    expect(res.body).toHaveProperty('userAge');
    expect(res.body).toHaveProperty('userEmail');
    expect(res.body).toHaveProperty('userMobile');
    expect(res.body).toHaveProperty('userGenderId');
    expect(res.body).toHaveProperty('languageEnum');
    expect(res.body).toHaveProperty('locationId');
    expect(res.body).toHaveProperty('locationName');
    expect(res.body).toHaveProperty('userAvatar');
    expect(res.body).toHaveProperty('isEmailLogin');
    expect(res.body).toHaveProperty('isParticipant');
  });

  test('SC-03: User tags are returned in response', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.userTag)).toBe(true);
  });

  test('SC-04: User triggers are returned in response', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.triggers)).toBe(true);
  });

  test('SC-05: User communities are returned in response', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.userCommunity)).toBe(true);
  });

  test('SC-06: Email login flag is preserved', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect([true, 1]).toContain(res.body.isEmailLogin);
  });

  test('SC-07: Location information is correct', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.locationId).toBe(1);
    expect(res.body.locationName).toBe('Mumbai');
  });

  test('SC-08: Gender enum is returned as number', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.userGenderId).toBe('number');
  });

  test('SC-09: Mobile number is returned as number', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.userMobile).toBe('number');
  });

});

describe('GET /users/:userId — Failure Cases', () => {

  test('FC-01: Non-existent userId → 404', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/9999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  test('FC-02: No Authorization header → 403', async () => {
    const { userId } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`);

    expect(res.status).toBe(403);
  });

  test('FC-03: Invalid userId (string) → 422', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/not-an-id`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-04: userId=0 → 422', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-05: Invalid token → 401', async () => {
    const { userId } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', 'Bearer invalid.token.here');

    expect([401, 403]).toContain(res.status);
  });

});

describe('GET /users/:userId — Edge Cases', () => {

  test('EC-01: Get user multiple times returns same data', async () => {
    const { userId, token } = testUser;

    const r1 = await request(app).get(`${BASE_USERS}/${userId}`).set('Authorization', `Bearer ${token}`);
    const r2 = await request(app).get(`${BASE_USERS}/${userId}`).set('Authorization', `Bearer ${token}`);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.userId).toBe(r2.body.userId);
    expect(r1.body.userName).toBe(r2.body.userName);
  });

  test('EC-02: Get user with no relationships (tags/triggers)', async () => {
    const cleanUser = await registerAndLogin({
      userTag: [],
      triggers: [],
      userCommunity: [],
    });

    const res = await request(app)
      .get(`${BASE_USERS}/${cleanUser.userId}`)
      .set('Authorization', `Bearer ${cleanUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.userTag.length).toBe(0);
    expect(res.body.triggers.length).toBe(0);
    expect(res.body.userCommunity.length).toBe(0);
  });

  test('EC-03: Response format is consistent', async () => {
    const { userId, token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.userId).toBe('number');
    expect(typeof res.body.userName).toBe('string');
    expect(typeof res.body.userAge).toBe('number');
    expect(typeof res.body.isEmailLogin).toBe('boolean' || 'number');
  });

  test('EC-04: Large user ID works correctly', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}/999999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

});
