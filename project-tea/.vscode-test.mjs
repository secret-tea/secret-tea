import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/integration/*.test.js',
	workspaceFolder: './sample',
	mocha: {
		reporter: 'mocha-multi-reporters',
		reporterOptions: {
			configFile: 'reporter-config.json'
		}
	}
});
