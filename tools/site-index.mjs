import fs from 'fs/promises';

const names = [];

for await (const dirEntry of await fs.opendir('./src/static/sites')) {
  // filter yml files
  if (dirEntry.isFile() && dirEntry.name.endsWith('.yml')) {
    const name = dirEntry.name.slice(0, -4);
    names.push(name);
  }
}

const content = names.join('\n');

await fs.writeFile('./src/static/sites/index.txt', content);
