require('dotenv').config();
const { Pool } = require('pg');
const url = require('url');

// Parse the DATABASE_URL to get connection parameters
const dbUrl = new URL(process.env.DATABASE_URL);
const { hostname, port, username, password, pathname } = dbUrl;
const database = pathname.substring(1); // remove leading slash
const searchParam = dbUrl.searchParams.get('options');

// Default database to connect to (usually 'postgres')
const defaultDatabase = 'postgres';

// Create a pool to the default database
const defaultPool = new Pool({
  host: hostname,
  port: port,
  user: username,
  password: password,
  database: defaultDatabase,
});

// Function to execute a query on the default pool
async function query(text, params) {
  const client = await defaultPool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function setup() {
  try {
    // Check if the target database exists
    const res = await query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database]
    );
    const exists = res.rowCount > 0;

    if (!exists) {
      console.log(`Database "${database}" does not exist. Creating...`);
      // Create the database
      await query(`CREATE DATABASE "${database}"`);
      console.log(`Database "${database}" created.`);
    } else {
      console.log(`Database "${database}" already exists.`);
    }

    // Now connect to the target database to ensure schema exists
    const targetPool = new Pool({
      host: hostname,
      port: port,
      user: username,
      password: password,
      database: database,
    });

    const targetClient = await targetPool.connect();
    try {
      // Check if the schema exists
      const schemaRes = await targetClient.query(
        'SELECT 1 FROM pg_namespace WHERE nspname = $1',
        ['wastetrack_runtime']
      );
      const schemaExists = schemaRes.rowCount > 0;

      if (!schemaExists) {
        console.log('Schema "wastetrack_runtime" does not exist. Creating...');
        await targetClient.query('CREATE SCHEMA wastetrack_runtime');
        console.log('Schema "wastetrack_runtime" created.');
      } else {
        console.log('Schema "wastetrack_runtime" already exists.');
      }

      // Set the search path for the current session (optional, but we can set it for migrations)
      await targetClient.query('SET search_path TO wastetrack_runtime');
      console.log('Search path set to wastetrack_runtime.');
    } finally {
      targetClient.release();
      await targetPool.end();
    }

    await defaultPool.end();
    console.log('Database setup complete.');
  } catch (err) {
    console.error('Error during database setup:', err);
    process.exit(1);
  }
}

setup();