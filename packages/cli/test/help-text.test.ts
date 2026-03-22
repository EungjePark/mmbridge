import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.join(__dirname, '..', 'dist', 'bin', 'mmbridge.js');

function getHelpOutput(args: string[]): string {
  return execFileSync(process.execPath, [binPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_NO_WARNINGS: '1',
    },
  });
}

test('root help uses the control-plane taxonomy', () => {
  const output = getHelpOutput(['--help']);

  assert.match(output, /Multi-model thinking and review control plane for coding agents/);
  assert.match(output, /\n {2}tui \[options\]\s+Open the interactive TUI control plane/);
  assert.match(output, /\n {2}review \[options\]\s+Run a multi-model review for a change or/);
  assert.match(output, /\n {2}research \[options\] <topic>\s+Research a topic using multiple AI models/);
  assert.match(output, /\n {2}embrace \[options\] <task>\s+Orchestrate research, debate, checkpointing,/);

  for (const command of [
    'review',
    'followup',
    'resume',
    'doctor',
    'gate',
    'handoff',
    'memory',
    'sync-agents',
    'init',
    'tui',
    'diff',
    'research',
    'debate',
    'security',
    'embrace',
    'hook',
  ]) {
    assert.ok(output.includes(`\n  ${command}`), `expected ${command} in root help`);
  }

  assert.doesNotMatch(output, /mmbridge dashboard/);
});

test('tui help still exposes the tab switcher', () => {
  const output = getHelpOutput(['tui', '--help']);

  assert.match(output, /Open the interactive TUI control plane/);
  assert.match(output, /Open directly to a tab \(dashboard\|sessions\|config\)/);
});

test('doctor help matches the documented tooling wording', () => {
  const output = getHelpOutput(['doctor', '--help']);

  assert.match(output, /Inspect local tooling and binary installation/);
});
