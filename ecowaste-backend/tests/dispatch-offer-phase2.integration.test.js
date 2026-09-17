const assert = require('node:assert/strict');

const { closeDb, query } = require('../dist/config/db');
const {
  DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS,
  dispatchPickupToNextCollector,
  listCollectorPendingOffers,
  processTimedOutDispatchOffers,
  respondCollectorOffer,
} = require('../dist/services/dispatchService');

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const createUser = async (input) => {
  const email = `${input.role}-${uniqueSuffix()}@phase2.test`;
  const result = await query(
    `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        area,
        is_active,
        collector_verification_status,
        last_login_at
      )
      VALUES ($1, $2, $3, $4, $5, true, 'approved', now() - make_interval(mins => $6::int))
      RETURNING id
    `,
    [input.name, email, 'phase2-test-hash', input.role, input.area, input.lastLoginOffsetMinutes]
  );

  const userId = result.rows[0] && result.rows[0].id;
  assert.ok(userId, 'user should be created');
  return userId;
};

const createCollectorWithLocation = async (input) => {
  const userId = await createUser({
    role: 'collector',
    name: input.name,
    area: input.area,
    lastLoginOffsetMinutes: input.lastLoginOffsetMinutes,
  });

  await query(
    `
      INSERT INTO user_locations (user_id, role, latitude, longitude, accuracy, updated_at)
      VALUES ($1, 'collector', $2, $3, 5, now())
    `,
    [userId, input.lat, input.lng]
  );

  return userId;
};

const createApprovedPickup = async (input) => {
  const result = await query(
    `
      INSERT INTO pickup_requests (
        user_id,
        waste_type,
        scheduled_date,
        status,
        address,
        latitude,
        longitude,
        pickup_category
      )
      VALUES ($1, 'household', now() + interval '4 hours', 'approved', $2, $3, $4, 'standard')
      RETURNING id
    `,
    [input.residentId, input.address, input.lat, input.lng]
  );

  const pickupId = result.rows[0] && result.rows[0].id;
  assert.ok(pickupId, 'pickup should be created');
  return pickupId;
};

const cleanupFixture = async (fixture) => {
  if (fixture.pickupIds.length > 0) {
    await query(
      `
        DELETE FROM collector_assignments
        WHERE pickup_request_id = ANY($1::uuid[])
      `,
      [fixture.pickupIds]
    );
    await query(
      `
        DELETE FROM collector_dispatch_offers
        WHERE entity_type = 'pickup'
          AND entity_id = ANY($1::uuid[])
      `,
      [fixture.pickupIds]
    );
    await query(
      `
        DELETE FROM pickup_requests
        WHERE id = ANY($1::uuid[])
      `,
      [fixture.pickupIds]
    );
  }

  if (fixture.userIds.length > 0) {
    await query(
      `
        DELETE FROM notifications
        WHERE user_id = ANY($1::uuid[])
      `,
      [fixture.userIds]
    );
    await query(
      `
        DELETE FROM rewards
        WHERE user_id = ANY($1::uuid[])
      `,
      [fixture.userIds]
    );
    await query(
      `
        DELETE FROM collector_dispatch_offers
        WHERE collector_id = ANY($1::uuid[])
           OR resident_id = ANY($1::uuid[])
      `,
      [fixture.userIds]
    );
    await query(
      `
        DELETE FROM user_locations
        WHERE user_id = ANY($1::uuid[])
      `,
      [fixture.userIds]
    );
    await query(
      `
        DELETE FROM users
        WHERE id = ANY($1::uuid[])
      `,
      [fixture.userIds]
    );
  }
};

const integrationCases = [
  {
    name: 'expires timed-out offers and redispatches to the next collector',
    run: async () => {
      const fixture = { userIds: [], pickupIds: [] };
      try {
        const residentId = await createUser({
          role: 'resident',
          name: 'Phase2 Resident Timeout',
          area: 'phase2-zone',
          lastLoginOffsetMinutes: 0,
        });
        fixture.userIds.push(residentId);

        const collectorAId = await createCollectorWithLocation({
          name: 'Phase2 Collector A',
          area: 'phase2-zone',
          lat: 3.8601,
          lng: 11.5202,
          lastLoginOffsetMinutes: 0,
        });
        const collectorBId = await createCollectorWithLocation({
          name: 'Phase2 Collector B',
          area: 'phase2-zone',
          lat: 3.8652,
          lng: 11.5254,
          lastLoginOffsetMinutes: 45,
        });
        fixture.userIds.push(collectorAId, collectorBId);

        const pickupId = await createApprovedPickup({
          residentId,
          lat: 3.8607,
          lng: 11.5208,
          address: 'Phase2 Timeout Street',
        });
        fixture.pickupIds.push(pickupId);

        const dispatchResult = await dispatchPickupToNextCollector(pickupId);
        assert.equal(dispatchResult.dispatched, true);
        assert.equal(dispatchResult.collectorId, collectorAId);

        const initialOffersA = await listCollectorPendingOffers(collectorAId);
        assert.equal(initialOffersA.length, 1);
        assert.ok(initialOffersA[0].seconds_remaining > 0);

        await query(
          `
            UPDATE collector_dispatch_offers
            SET offered_at = now() - interval '1 day'
            WHERE id = $1
          `,
          [initialOffersA[0].id]
        );

        const expiryCheck = await query(
          `
            SELECT offered_at <= now() - make_interval(secs => $2::int) AS should_expire
            FROM collector_dispatch_offers
            WHERE id = $1
          `,
          [initialOffersA[0].id, DISPATCH_OFFER_RESPONSE_WINDOW_SECONDS]
        );
        assert.equal(expiryCheck.rows[0] && expiryCheck.rows[0].should_expire, true);

        const processedCount = await processTimedOutDispatchOffers({ collectorId: collectorAId });
        assert.equal(processedCount, 1);

        const refreshedOffersA = await listCollectorPendingOffers(collectorAId);
        assert.equal(refreshedOffersA.length, 0);

        const offersB = await listCollectorPendingOffers(collectorBId);
        assert.equal(offersB.length, 1);
        assert.equal(offersB[0].entity_id, pickupId);

        const expiredOffer = await query(
          `
            SELECT status, rejection_reason
            FROM collector_dispatch_offers
            WHERE id = $1
            LIMIT 1
          `,
          [initialOffersA[0].id]
        );
        assert.equal(expiredOffer.rows[0] && expiredOffer.rows[0].status, 'expired');
        assert.equal(
          expiredOffer.rows[0] && expiredOffer.rows[0].rejection_reason,
          'offer_timeout'
        );
      } finally {
        await cleanupFixture(fixture);
      }
    },
  },
  {
    name: 'accepting an offer returns assignment id and moves pickup to assigned',
    run: async () => {
      const fixture = { userIds: [], pickupIds: [] };
      try {
        const residentId = await createUser({
          role: 'resident',
          name: 'Phase2 Resident Accept',
          area: 'phase2-zone',
          lastLoginOffsetMinutes: 0,
        });
        fixture.userIds.push(residentId);

        const collectorId = await createCollectorWithLocation({
          name: 'Phase2 Collector Accept',
          area: 'phase2-zone',
          lat: 3.865,
          lng: 11.525,
          lastLoginOffsetMinutes: 0,
        });
        fixture.userIds.push(collectorId);

        const pickupId = await createApprovedPickup({
          residentId,
          lat: 3.8653,
          lng: 11.5252,
          address: 'Phase2 Accept Avenue',
        });
        fixture.pickupIds.push(pickupId);

        const dispatchResult = await dispatchPickupToNextCollector(pickupId);
        assert.equal(dispatchResult.dispatched, true);
        assert.equal(dispatchResult.collectorId, collectorId);

        const offers = await listCollectorPendingOffers(collectorId);
        assert.equal(offers.length, 1);

        const response = await respondCollectorOffer({
          collectorId,
          offerId: offers[0].id,
          action: 'accept',
        });

        assert.equal(response.action, 'accepted');
        assert.equal(response.entity_type, 'pickup');
        assert.equal(response.entity_id, pickupId);
        assert.ok(response.assignment_id);

        const pickupRow = await query(
          `
            SELECT status
            FROM pickup_requests
            WHERE id = $1
          `,
          [pickupId]
        );
        assert.equal(pickupRow.rows[0] && pickupRow.rows[0].status, 'assigned');

        const assignmentRow = await query(
          `
            SELECT id, status, collector_id
            FROM collector_assignments
            WHERE id = $1
          `,
          [response.assignment_id]
        );
        assert.equal(assignmentRow.rows[0] && assignmentRow.rows[0].status, 'assigned');
        assert.equal(assignmentRow.rows[0] && assignmentRow.rows[0].collector_id, collectorId);
      } finally {
        await cleanupFixture(fixture);
      }
    },
  },
  {
    name: 'expired offers cannot be accepted and get reassigned',
    run: async () => {
      const fixture = { userIds: [], pickupIds: [] };
      try {
        const residentId = await createUser({
          role: 'resident',
          name: 'Phase2 Resident Expired Accept',
          area: 'phase2-zone',
          lastLoginOffsetMinutes: 0,
        });
        fixture.userIds.push(residentId);

        const collectorAId = await createCollectorWithLocation({
          name: 'Phase2 Collector Expired A',
          area: 'phase2-zone',
          lat: 3.8701,
          lng: 11.5302,
          lastLoginOffsetMinutes: 0,
        });
        const collectorBId = await createCollectorWithLocation({
          name: 'Phase2 Collector Expired B',
          area: 'phase2-zone',
          lat: 3.8744,
          lng: 11.5346,
          lastLoginOffsetMinutes: 30,
        });
        fixture.userIds.push(collectorAId, collectorBId);

        const pickupId = await createApprovedPickup({
          residentId,
          lat: 3.8703,
          lng: 11.5303,
          address: 'Phase2 Expired Reassign Road',
        });
        fixture.pickupIds.push(pickupId);

        const dispatchResult = await dispatchPickupToNextCollector(pickupId);
        assert.equal(dispatchResult.dispatched, true);
        assert.equal(dispatchResult.collectorId, collectorAId);

        const offersA = await listCollectorPendingOffers(collectorAId);
        assert.equal(offersA.length, 1);

        await query(
          `
            UPDATE collector_dispatch_offers
            SET offered_at = now() - interval '1 day'
            WHERE id = $1
          `,
          [offersA[0].id]
        );

        await assert.rejects(
          respondCollectorOffer({
            collectorId: collectorAId,
            offerId: offersA[0].id,
            action: 'accept',
          }),
          (error) => {
            const message = error instanceof Error ? error.message : '';
            assert.match(message, /resolved|expired|reassigned/i);
            return true;
          }
        );

        const oldOffer = await query(
          `
            SELECT status
            FROM collector_dispatch_offers
            WHERE id = $1
          `,
          [offersA[0].id]
        );
        assert.equal(oldOffer.rows[0] && oldOffer.rows[0].status, 'expired');

        const offersB = await listCollectorPendingOffers(collectorBId);
        assert.equal(offersB.length, 1);
        assert.equal(offersB[0].entity_id, pickupId);
      } finally {
        await cleanupFixture(fixture);
      }
    },
  },
];

const run = async () => {
  let failed = 0;

  for (const integrationCase of integrationCases) {
    const startedAt = Date.now();
    try {
      await integrationCase.run();
      const durationMs = Date.now() - startedAt;
      console.log(`PASS ${integrationCase.name} (${durationMs}ms)`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${integrationCase.name}`);
      console.error(error);
    }
  }

  await closeDb();

  if (failed > 0) {
    process.exitCode = 1;
  }
};

void run();
