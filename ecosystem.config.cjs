/**
 * PM2 Ecosystem Configuration for Smart Quiz Platform (Dockersiz Production)
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 status
 *   pm2 logs
 *   pm2 restart all
 */

module.exports = {
  apps: [
    {
      name: 'smart-quiz-api',
      script: './apps/api/dist/main.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        API_PORT: 4000,
      },
    },
    {
      name: 'smart-quiz-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start apps/web -p 3000',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
