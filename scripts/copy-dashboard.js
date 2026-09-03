const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', 'dashboard');
const target = path.resolve(__dirname, '..', 'dist', 'dashboard');

if (!fs.existsSync(path.join(source, 'index.html'))) {
  throw new Error(`Dashboard source not found: ${source}`);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Copied dashboard assets to ${target}`);
