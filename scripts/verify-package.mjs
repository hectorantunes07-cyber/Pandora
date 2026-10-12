// Verifies build contents and archive integrity; never launches a Windows package.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, stat, writeFile, mkdtemp, rm, open } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const release = join(root, 'release');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const portableOnly = process.argv.includes('--portable-only');
const sevenZip = process.env.PANDORA_7ZIP || (process.platform === 'win32' ? join(process.env.ProgramFiles || 'C:\\Program Files', '7-Zip', '7z.exe') : '7zz');
async function digest(file) {
  const hash = createHash('sha256');
  for await (const data of createReadStream(file)) hash.update(data);
  return hash.digest('hex');
}
async function pe(file) {
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    assert.ok(bytesRead >= 256 && header.toString('ascii', 0, 2) === 'MZ', `Invalid executable: ${file}`);
    const offset = header.readUInt32LE(0x3c);
    assert.ok(offset + 264 <= bytesRead && header.toString('ascii', offset, offset + 4) === 'PE\0\0', 'Invalid PE header');
    const magic = header.readUInt16LE(offset + 24);
    assert.ok(magic === 0x10b || magic === 0x20b, 'Unsupported PE optional header');
    const certificate = offset + 24 + (magic === 0x20b ? 112 : 96) + 4 * 8;
    return { machine: header.readUInt16LE(offset + 4), certificateBytes: header.readUInt32LE(certificate + 4) };
  } finally { await handle.close(); }
}
async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = join(prefix, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Unexpected build symlink: ${relative}`);
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), relative));
    else result.push(relative);
  }
  return result;
}
async function verifyPayload(directory) {
  assert.equal((await pe(join(directory, 'PANDORA.exe'))).machine, 0x8664, 'Embedded app must be x64');
  for (const folder of ['dist', 'dist-electron']) {
    for (const relative of await files(join(root, folder))) {
      assert.equal(await digest(join(directory, 'resources', 'app', folder, relative)), await digest(join(root, folder, relative)), `Bundled file differs: ${folder}/${relative}`);
    }
  }
  const metadata = JSON.parse(await readFile(join(directory, 'resources/app/package.json'), 'utf8'));
  assert.equal(metadata.version, pkg.version);
  assert.equal(metadata.main, pkg.main);
  for (const notice of ['LICENSE.electron.txt', 'LICENSES.chromium.html', 'resources/app/LICENSE', 'resources/app/THIRD_PARTY_NOTICES.md']) {
    assert.ok((await stat(join(directory, notice))).size > 0, `Missing notice: ${notice}`);
  }
}
await verifyPayload(join(release, 'win-unpacked'));
const { stdout: commit } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
const { stdout: dirty } = await exec('git', ['status', '--porcelain'], { cwd: root });
const artifacts = [];
for (const kind of portableOnly ? ['Portable'] : ['Setup', 'Portable']) {
  const filename = `PANDORA-${kind}-${pkg.version}-x64.exe`;
  const artifact = join(release, filename);
  const info = await stat(artifact);
  assert.ok(info.size > 10_000_000, `Incomplete package: ${filename}`);
  const launcher = await pe(artifact);
  assert.ok([0x14c, 0x8664].includes(launcher.machine), 'Unexpected launcher architecture');
  await exec(sevenZip, ['t', artifact], { timeout: 120000, maxBuffer: 1024 * 1024 });
  if (kind === 'Portable') {
    const temp = await mkdtemp(join(tmpdir(), 'pandora-package-check-'));
    try {
      await exec(sevenZip, ['x', artifact, `-o${temp}`, '-y'], { timeout: 120000 });
      const archives = (await files(temp)).filter(name => basename(name) === 'app-64.7z');
      assert.equal(archives.length, 1, 'Exactly one x64 portable payload is required');
      const archive = join(temp, archives[0]);
      await exec(sevenZip, ['t', archive], { timeout: 120000, maxBuffer: 1024 * 1024 });
      const extracted = join(temp, 'verified-payload');
      await exec(sevenZip, ['x', archive, `-o${extracted}`, '-y'], { timeout: 120000 });
      await verifyPayload(extracted);
      assert.equal(await digest(join(extracted, 'PANDORA.exe')), await digest(join(release, 'win-unpacked/PANDORA.exe')), 'Embedded executable differs');
    } finally { await rm(temp, { recursive: true, force: true }); }
  }
  if (kind === 'Setup') {
    const temp = await mkdtemp(join(tmpdir(), 'pandora-installer-check-'));
    try {
      await exec(sevenZip, ['x', artifact, `-o${temp}`, '-y'], { timeout: 120000 });
      await verifyPayload(temp);
      assert.equal(await digest(join(temp, 'PANDORA.exe')), await digest(join(release, 'win-unpacked/PANDORA.exe')), 'Installer executable differs');
      assert.ok((await stat(join(temp, 'Uninstall PANDORA.exe'))).size > 0, 'Installer must contain an uninstaller');
    } finally { await rm(temp, { recursive: true, force: true }); }
  }
  const sha256 = await digest(artifact);
  await writeFile(`${artifact}.sha256`, `${sha256}  ${filename}\n`);
  artifacts.push({ filename, bytes: info.size, sha256, launcherMachine: launcher.machine, certificateBytes: launcher.certificateBytes });
}
const manifest = { product: 'PANDORA', version: pkg.version, createdBy: 'Sonnier', sourceCommit: commit.trim(), sourceDirty: !!dirty.trim(), verifiedAt: new Date().toISOString(), payloadArchitecture: 'x64', archiveIntegrity: 'passed', bundledCodeMatchesBuild: true, windowsLaunchVerified: false, artifacts };
await writeFile(join(release, 'verification.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
