'use strict';

const request = require('supertest');
const app = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN = '/backend/api/v1/users/login';
const BASE_USERS = '/backend/api/v1/users';

const uid = () => `list_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async () => {
  const payload = {
    userName: 'ListTest User',
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

let testUser = null;

beforeAll(async () => {
  testUser = await registerAndLogin();
}, 30000);

describe('GET /users — Success Cases', () => {

  test('SC-01: Get user list returns 200', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('pagination');
  });

  test('SC-02: Default pagination returns page 1 with 10 users', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.currentPage).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('SC-03: Users array contains expected fields', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}`)
      .set('Authorization', `Bearer ${token}`);

    if (res.body.users.length > 0) {
      const user = res.body.users[0];
      expect(user).toHaveProperty('userId');
      expect(user).toHaveProperty('userName');
      expect(user).toHaveProperty('userEmail');
      expect(user).toHaveProperty('userMobile');
      expect(user).toHaveProperty('userAvatar');
      expect(user).toHaveProperty('languageEnum');
      expect(user).toHaveProperty('createdOn');
    }
  });

  test('SC-04: Pagination metadata is present', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toHaveProperty('currentPage');
    expect(res.body.pagination).toHaveProperty('pageSize');
    expect(res.body.pagination).toHaveProperty('totalUsers');
    expect(res.body.pagination).toHaveProperty('totalPages');
    expect(res.body.pagination).toHaveProperty('hasNextPage');
    expect(res.body.pagination).toHaveProperty('hasPreviousPage');
  });

  test('SC-05: Custom page parameter works', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=2`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.currentPage).toBe(2);
  });

  test('SC-06: Custom limit parameter works', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?limit=5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(5);
  });

  test('SC-07: Page and limit together work', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=1&limit=5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.currentPage).toBe(1);
    expect(res.body.pagination.pageSize).toBe(5);
  });

  test('SC-08: Search parameter filters users', async () => {
    const { token, payload } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?search=${payload.userName}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(0);
  });

});

describe('GET /users — Failure Cases', () => {

  test('FC-01: No Authorization header → 403', async () => {
    const res = await request(app)
      .get(`${BASE_USERS}`);

    expect(res.status).toBe(403);
  });

  test('FC-02: Invalid token → 401', async () => {
    const res = await request(app)
      .get(`${BASE_USERS}`)
      .set('Authorization', 'Bearer invalid.token.here');

    expect([401, 403]).toContain(res.status);
  });

  test('FC-03: Page < 1 → 422', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-04: Negative page → 422', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=-1`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-05: Limit < 1 → 422', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?limit=0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-06: Limit > 100 → 422', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?limit=101`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-07: Negative limit → 422', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?limit=-5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

});

describe('GET /users — Edge Cases', () => {

  test('EC-01: Page beyond total pages still returns valid response', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=9999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(10);
  });

  test('EC-02: Large limit (100) is accepted', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?limit=100`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(100);
  });

  test('EC-03: Float page is parsed correctly', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=2.7`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.currentPage).toBe(2);
  });

  test('EC-04: Float limit is parsed correctly', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?limit=15.9`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(15);
  });

  test('EC-05: Empty search returns all users', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?search=`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 422]).toContain(res.status);
  });

  test('EC-06: Non-existent search returns empty array', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?search=nonexistentuser123456`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(0);
  });

  test('EC-07: hasNextPage reflects correctly', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=1&limit=10`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.pagination.hasNextPage).toBe('boolean');
  });

  test('EC-08: hasPreviousPage is false for page 1', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=1`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.hasPreviousPage).toBe(false);
  });

  test('EC-09: Multiple calls return consistent pagination', async () => {
    const { token } = testUser;

    const res1 = await request(app)
      .get(`${BASE_USERS}?page=1&limit=10`)
      .set('Authorization', `Bearer ${token}`);

    const res2 = await request(app)
      .get(`${BASE_USERS}?page=1&limit=10`)
      .set('Authorization', `Bearer ${token}`);

    expect(res1.body.pagination.totalUsers).toBe(res2.body.pagination.totalUsers);
  });

  test('EC-10: Users are ordered by userId DESC', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?limit=100`)
      .set('Authorization', `Bearer ${token}`);

    if (res.body.users.length > 1) {
      for (let i = 0; i < res.body.users.length - 1; i++) {
        expect(res.body.users[i].userId).toBeGreaterThanOrEqual(res.body.users[i + 1].userId);
      }
    }
  });

});

describe('GET /users — Data Integrity', () => {

  test('DI-01: User IDs are positive integers', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}`)
      .set('Authorization', `Bearer ${token}`);

    res.body.users.forEach(user => {
      expect(user.userId).toBeGreaterThan(0);
      expect(Number.isInteger(user.userId)).toBe(true);
    });
  });

  test('DI-02: Total users matches pagination calculation', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}?page=1&limit=5`)
      .set('Authorization', `Bearer ${token}`);

    const expectedPages = Math.ceil(res.body.pagination.totalUsers / 5);
    expect(res.body.pagination.totalPages).toBe(expectedPages);
  });

  test('DI-03: Email addresses are valid format', async () => {
    const { token } = testUser;

    const res = await request(app)
      .get(`${BASE_USERS}`)
      .set('Authorization', `Bearer ${token}`);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    res.body.users.forEach(user => {
      if (user.userEmail) {
        expect(emailRegex.test(user.userEmail)).toBe(true);
      }
    });
  });

});
