const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Robin123.@localhost:5432/ecowaste_db',
});

async function insertAdmin() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash('admin123', 12);
    const result = await client.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING RETURNING id, email, role',
      ['Admin User', 'admin@gmail.com', hash, 'admin', true]
    );

    if (result.rows.length > 0) {
      console.log('✅ Admin user created:', result.rows[0]);
    } else {
      console.log('⚠️ Admin user already exists');
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

insertAdmin();
