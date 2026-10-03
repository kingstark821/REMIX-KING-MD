import fs from 'node:fs';
import path from 'node:path';

export function loadStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}, null, 2));
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
export function saveStore(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
