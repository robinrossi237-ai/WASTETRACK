import { Pool, type QueryResultRow } from 'pg';

import { env } from '../config/env';
import { hashPassword } from '../services/authService';

type Role = 'resident' | 'collector' | 'admin';

type DemoUser = {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  area?: string;
  coordinates?: { lat: number; lng: number };
};

// Demo credentials (documented in the README / seed comments).
const DEMO_PASSWORD = 'DemoPass123!';

// Douala, Cameroon neighbourhoods with approximate lat/lng.
const DEMO_USERS: DemoUser[] = [
  {
    name: 'Admin Démo',
    email: 'admin@wastetrack.app',
    password: DEMO_PASSWORD,
    role: 'admin',
    phone: '+237600000001',
    area: 'Akwa',
  },
  {
    name: 'Admin Robin',
    email: 'robinrossi@gmail.com',
    password: 'robin123',
    role: 'admin',
    phone: '+237600000007',
    area: 'Akwa',
  },
  {
    name: 'Mireille Ngo',
    email: 'resident@wastetrack.app',
    password: DEMO_PASSWORD,
    role: 'resident',
    phone: '+237600000002',
    area: 'Bonapriso',
    coordinates: { lat: 4.0333, lng: 9.6833 },
  },
  {
    name: 'Paul Mbarga',
    email: 'resident2@wastetrack.app',
    password: DEMO_PASSWORD,
    role: 'resident',
    phone: '+237600000003',
    area: 'Bonanjo',
    coordinates: { lat: 4.0421, lng: 9.6928 },
  },
  {
    name: 'Aline Kamga',
    email: 'resident3@wastetrack.app',
    password: DEMO_PASSWORD,
    role: 'resident',
    phone: '+237600000004',
    area: 'Deido',
    coordinates: { lat: 4.0631, lng: 9.6872 },
  },
  {
    name: 'Jean-Pierre Talla',
    email: 'collector@wastetrack.app',
    password: DEMO_PASSWORD,
    role: 'collector',
    phone: '+237600000005',
    area: 'Akwa',
    coordinates: { lat: 4.0496, lng: 9.6908 },
  },
  {
    name: 'Sylvie Etoundi',
    email: 'collector2@wastetrack.app',
    password: DEMO_PASSWORD,
    role: 'collector',
    phone: '+237600000006',
    area: 'Bonapriso',
    coordinates: { lat: 4.0281, lng: 9.6819 },
  },
];

const WASTE_TYPES = ['household', 'plastic', 'organic', 'electronic', 'hazardous'] as const;

const round = (value: number): number => Math.round(value * 1000000) / 1000000;

const upsertUser = async (
  pool: Pool,
  user: DemoUser
): Promise<QueryResultRow> => {
  const passwordHash = await hashPassword(user.password);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone, area, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       phone = EXCLUDED.phone,
       area = EXCLUDED.area,
       role = EXCLUDED.role,
       is_active = true
     RETURNING id, role, area`,
    [user.name, user.email, passwordHash, user.phone ?? null, user.area ?? null, user.role]
  );
  return result.rows[0];
};

const seedUserLocations = async (
  pool: Pool,
  userId: string,
  user: DemoUser
): Promise<void> => {
  if (!user.coordinates) return;
  await pool.query(
    `INSERT INTO user_locations (user_id, role, latitude, longitude, accuracy)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       role = EXCLUDED.role,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       accuracy = EXCLUDED.accuracy,
       updated_at = now()`,
    [userId, user.role, user.coordinates.lat, user.coordinates.lng, 12]
  );
};

const seedPickups = async (
  pool: Pool,
  residents: QueryResultRow[],
  collectors: QueryResultRow[]
): Promise<void> => {
  const coordSets: Array<[number, number]> = [
    [4.0331, 9.6911],
    [4.0289, 9.6842],
    [4.0388, 9.6955],
    [4.0627, 9.6884],
    [4.0455, 9.7021],
  ];

  const now = new Date();
  for (let i = 0; i < 6; i += 1) {
    const resident = residents[i % residents.length];
    const wasteType = WASTE_TYPES[i % WASTE_TYPES.length];
    const [lat, lng] = coordSets[i % coordSets.length];
    const status =
      i < 2 ? 'completed' : i < 4 ? 'assigned' : 'in_progress';

    const pickupResult = await pool.query(
      `INSERT INTO pickup_requests (
         user_id, waste_type, scheduled_date, status, description, address,
         latitude, longitude
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, waste_type`,
      [
        resident.id,
        wasteType,
        new Date(now.getTime() - ((6 - i) * 6 * 60 * 60 * 1000)),
        status,
        `Collecte démo ${i + 1} (${wasteType}) pour ${resident.area}`,
        `${resident.area}, Douala`,
        round(lat),
        round(lng),
      ]
    );
    const pickup = pickupResult.rows[0];

    if (status === 'completed' || status === 'in_progress' || status === 'assigned') {
      const collector = collectors[i % collectors.length];
      const assignedAt = new Date(now.getTime() - ((6 - i) * 5 * 60 * 60 * 1000));
      const completed = status === 'completed';
      const completedAt = completed
        ? new Date(assignedAt.getTime() + 90 * 60 * 1000)
        : null;
      const startedAt = completed ? completedAt! : new Date(now.getTime() - 20 * 60 * 1000);

      await pool.query(
        `INSERT INTO collector_assignments (
           collector_id, pickup_request_id, assigned_at, started_at,
           completed_at, status
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (collector_id, pickup_request_id) DO NOTHING`,
        [
          collector.id,
          pickup.id,
          assignedAt,
          startedAt,
          completedAt,
          completed ? 'completed' : status === 'in_progress' ? 'in_progress' : 'assigned',
        ]
      );

      if (completed) {
        await pool.query(
          `INSERT INTO collector_dispatch_offers (
             entity_type, entity_id, collector_id, resident_id, status,
             distance_km, score, offered_at, responded_at
           ) VALUES ('pickup', $1, $2, $3, 'accepted', $4, $5, $6, $6)
           ON CONFLICT DO NOTHING`,
          [pickup.id, collector.id, resident.id, 2.4, 0.95, assignedAt]
        );
      }

      // Rewards for the resident that completed pickups.
      if (completed) {
        await pool.query(
          `INSERT INTO rewards (user_id, points, reason, related_entity_id)
           VALUES ($1, 20, 'pickup_participation', $2)
           ON CONFLICT DO NOTHING`,
          [resident.id, pickup.id]
        );
      }
    }
  }

  // A pending pickup assigned to nobody (available for dispatch).
  await pool.query(
    `INSERT INTO pickup_requests (
       user_id, waste_type, scheduled_date, status, description, address,
       latitude, longitude
     ) VALUES ($1, 'plastic', $2, 'approved', $3, $4, $5, $6)
     RETURNING id`,
    [
      residents[1].id,
      new Date(now.getTime() + 2 * 60 * 60 * 1000),
      'Sacs plastiques en attente de collecte',
      'Bonanjo, Douala',
      round(4.0415),
      round(9.6941),
    ]
  );
};

const seedReports = async (
  pool: Pool,
  residents: QueryResultRow[],
  collectors: QueryResultRow[],
  adminId: string
): Promise<void> => {
  const coordSets: Array<[number, number]> = [
    [4.0302, 9.6841],
    [4.0359, 9.6906],
    [4.0501, 9.6983],
    [4.0277, 9.6792],
  ];
  const now = new Date();

  for (let i = 0; i < 5; i += 1) {
    const resident = residents[i % residents.length];
    const [lat, lng] = coordSets[i % coordSets.length];
    const status = i < 2 ? 'approved' : i === 2 ? 'cleaned' : 'verified';

    const reportResult = await pool.query(
      `INSERT INTO waste_reports (
         user_id, photo_url, description, latitude, longitude, status,
         verified_by_admin_id, location_text, report_type
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        resident.id,
        null,
        `Dépôt sauvage de déchets signalé ${i + 1}`,
        round(lat),
        round(lng),
        status,
        adminId,
        `${resident.area}, Douala`,
        'litter',
      ]
    );
    const report = reportResult.rows[0];

    if (status === 'approved' || status === 'cleaned') {
      const collector = collectors[i % collectors.length];
      const cleanedAt = status === 'cleaned' ? new Date(now.getTime() - 3 * 60 * 60 * 1000) : null;
      const assignedAt = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      await pool.query(
        `UPDATE waste_reports
         SET cleaned_by_collector_id = $1,
             cleaned_at = $2,
             cleaned_note = $3,
             assigned_collector_id = $1,
             assigned_at = $4
         WHERE id = $5`,
        [collector.id, cleanedAt, status === 'cleaned' ? 'Déchets ramassés et transportés.' : null, assignedAt, report.id]
      );
    }

    await pool.query(
      `INSERT INTO rewards (user_id, points, reason, related_entity_id)
       VALUES ($1, 15, 'waste_report', $2)
       ON CONFLICT DO NOTHING`,
      [resident.id, report.id]
    );
  }
};

const seedContent = async (pool: Pool, adminId: string): Promise<void> => {
  const existing = await pool.query('SELECT id FROM education_content LIMIT 1');
  if (existing.rows.length > 0) {
    console.log('  Education content already exists, skipping.');
    return;
  }

  const items = [
    {
      title: 'Separating Waste at Home',
      body: 'Start by separating waste into three categories: recyclables (plastic, paper, metal), organic (food scraps, garden waste), and residual (everything else). Use clearly labeled bins and place them in an accessible area of your home. This simple step makes recycling much more efficient and reduces the amount of waste going to landfills.',
    },
    {
      title: 'Why Recycling Matters',
      body: 'Recycling conserves natural resources, saves energy, and reduces greenhouse gas emissions. For example, recycling one ton of paper saves 17 trees and 7,000 gallons of water. In Douala, proper recycling helps keep our streets clean and protects our waterways from pollution.',
    },
    {
      title: 'Composting Organic Waste',
      body: 'Organic waste like fruit peels, vegetable scraps, and coffee grounds can be composted to create nutrient-rich soil. Start a small compost bin in your backyard or balcony. Layer green materials (food scraps) with brown materials (dry leaves, cardboard) and keep it moist. In 2-3 months, you will have rich compost for your garden.',
    },
    {
      title: 'Safe Disposal of Hazardous Waste',
      body: 'Batteries, electronics, paint, and chemicals should never go in regular trash. These items contain toxic substances that can contaminate soil and water. Contact your local WasteTrack collector or visit the nearest collection point for proper disposal of hazardous materials.',
    },
    {
      title: 'Reducing Plastic Use',
      body: 'Plastic takes hundreds of years to decompose. Bring reusable bags when shopping, use a refillable water bottle, and avoid single-use plastics when possible. In Douala, many shops now accept reusable bags. Every piece of plastic you avoid is one less piece polluting our environment.',
    },
    {
      title: 'How WasteTrack Helps Your Community',
      body: 'WasteTrack connects residents with professional waste collectors in your neighborhood. Schedule regular pickups, report illegal dumping, and earn rewards for responsible waste management. The more you participate, the cleaner and healthier your community becomes.',
    },
  ];

  for (const item of items) {
    await pool.query(
      `INSERT INTO education_content (title, body, created_by_admin_id) VALUES ($1, $2, $3)`,
      [item.title, item.body, adminId]
    );
  }
  console.log('  Seeded %d education content items.', items.length);
};

const run = async (): Promise<void> => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
  });

  try {
    console.log('Seeding demo data…');

    const userIds: Record<string, QueryResultRow> = {};
    for (const user of DEMO_USERS) {
      userIds[user.email] = await upsertUser(pool, user);
    }

    const residents = DEMO_USERS.filter((u) => u.role === 'resident').map((u) => userIds[u.email]);
    const collectors = DEMO_USERS.filter((u) => u.role === 'collector').map((u) => userIds[u.email]);
    const admin = DEMO_USERS.filter((u) => u.role === 'admin').map((u) => userIds[u.email])[0];

    for (const user of DEMO_USERS) {
      await seedUserLocations(pool, userIds[user.email].id, user);
    }

    await seedPickups(pool, residents, collectors);
    await seedReports(pool, residents, collectors, admin.id);
    await seedContent(pool, admin.id);

    console.log('Seed complete.');
    console.log('Demo login credentials (password for all): %s', DEMO_PASSWORD);
    for (const user of DEMO_USERS) {
      console.log('  - %s (%s): %s', user.email, user.role, DEMO_PASSWORD);
    }
  } finally {
    await pool.end();
  }
};

void run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
