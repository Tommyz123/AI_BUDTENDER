const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

describe('Project Setup', () => {
    test('Directory structure should be correct', () => {
        const dirs = ['src/agent', 'src/tools', 'src/data', 'public', 'tests', 'data'];
        dirs.forEach(dir => {
            expect(fs.existsSync(path.join(__dirname, '..', dir))).toBe(true);
        });
    });

    test('package.json should have required dependencies', () => {
        const deps = ['express', 'openai', 'csv-parse', 'dotenv'];
        deps.forEach(dep => {
            expect(packageJson.dependencies[dep]).toBeDefined();
        });
    });

    test('package.json should have required scripts', () => {
        const scripts = ['start', 'dev', 'test', 'lint'];
        scripts.forEach(script => {
            expect(packageJson.scripts[script]).toBeDefined();
        });
    });

    test('NYE2.1.csv should exist in data directory', () => {
        expect(fs.existsSync(path.join(__dirname, '..', 'data', 'NYE2.1.csv'))).toBe(true);
    });
});
