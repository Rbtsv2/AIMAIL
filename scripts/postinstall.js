const { execSync } = require('child_process')
execSync('npx electron-rebuild -f -w better-sqlite3', { stdio: 'inherit' })
