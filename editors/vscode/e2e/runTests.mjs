import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
await runTests({
	vscodeExecutablePath,
	extensionDevelopmentPath: path.join(dir, '..'),
	extensionTestsPath: path.join(dir, 'suite.cjs'),
});
