const fs = require('node:fs/promises');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src', 'migrations');
const distDir = path.join(projectRoot, 'dist', 'migrations');

const copyMigrations = async () => {
  try {
    await fs.access(srcDir);
  } catch {
    console.log('No src/migrations directory found; skipping migration copy.');
    return;
  }

  await fs.mkdir(distDir, { recursive: true });

  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  const sqlFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.sql')).map((e) => e.name);

  await Promise.all(
    sqlFiles.map(async (file) => {
      const from = path.join(srcDir, file);
      const to = path.join(distDir, file);
      await fs.copyFile(from, to);
    })
  );

  console.log(`Copied ${sqlFiles.length} migration(s) to dist/migrations`);
};

copyMigrations().catch((err) => {
  console.error('Failed to copy migrations', err);
  process.exit(1);
});

