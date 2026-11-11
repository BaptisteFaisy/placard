#!/usr/bin/env node
import { cli } from './wire.js';

const exitCode = await cli.main(process.argv.slice(2));
if (exitCode !== 0) {
  process.exit(exitCode);
}
