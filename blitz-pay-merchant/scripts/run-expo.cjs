const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseEnv } = require('node:util');

const [target, ...args] = process.argv.slice(2);
if (!['local', 'server'].includes(target)) {
  console.error('Usage: node scripts/run-expo.cjs <local|server> <expo arguments>');
  process.exit(1);
}

const localEnv = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
const javaHome = process.env.APP_JAVA_HOME || localEnv.APP_JAVA_HOME;
if (args[0] === 'run:android' && javaHome && !existsSync(join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) {
  console.error('APP_JAVA_HOME must point to an installed JDK directory.');
  process.exit(1);
}

const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_PUBLIC_BACKEND_TARGET: target,
    ...(args[0] === 'run:android' && javaHome ? { JAVA_HOME: javaHome } : {}),
  },
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
