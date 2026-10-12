// Compile an exact owned-file list. Uninstall never recursively deletes a user folder.
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return;
  const files = [], directories = [];
  async function walk(dir, prefix = '') {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = path.join(prefix, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Installer cannot own symlinks.');
      if (entry.isDirectory()) { directories.push(rel); await walk(path.join(dir, entry.name), rel); }
      else files.push(rel);
    }
  }
  await walk(context.appOutDir);
  const quote = value => value.replaceAll('$', '$$').replaceAll('"', '$\\"');
  const win = value => quote(value.split(path.sep).join('\\'));
  const script = ['!macro PandoraInstallFiles', '  SetOutPath "$INSTDIR"'];
  for (const rel of files) {
    const parent = path.dirname(rel);
    script.push(`  SetOutPath "$INSTDIR${parent === '.' ? '' : '\\' + win(parent)}"`, `  File "${quote(path.join(context.appOutDir, rel))}"`);
  }
  script.push('!macroend', '!macro PandoraRemoveFiles');
  for (const rel of files) script.push(`  Delete "$INSTDIR\\${win(rel)}"`);
  // Empty directories only: preserve any files added by the user after installation.
  for (const rel of directories.sort((a,b) => b.length-a.length)) script.push(`  RMDir "$INSTDIR\\${win(rel)}"`);
  script.push('!macroend', '!macro PandoraCheckRemoval');
  for (const rel of files) script.push(`  IfFileExists "$INSTDIR\\${win(rel)}" uninstallFailed`);
  script.push('!macroend', '');
  await fs.mkdir(context.outDir, { recursive: true });
  await fs.writeFile(path.join(context.outDir, 'pandora-owned-files.nsh'), script.join('\n'));
};
