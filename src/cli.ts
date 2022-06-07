#!/usr/bin/env node

import * as fs from 'fs';

import { Command } from 'commander';
import * as mkdirs from 'mkdirs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { version } from '../package.json';
import { Converter } from './converter';

async function main(args: string[] = process.argv) {
  const cli = new Command();
  cli
    .version(version)
    .usage('[options]')
    .option('-i, --input <input-file>', 'A OpenAPI 3.1 file name or URL. Defaults to "openapi.yaml"')
    .option('-o, --output <output-file>', 'The output file, defaults to stdout if omitted')
    .option('-v, --verbose', 'Verbose output')
    .parse(args);
  const opts = cli.opts();
  const sourceFileName: string = opts.input || 'openapi.yaml';
  const outputFileName: string = opts.output;
  const source = yaml.load(fs.readFileSync(sourceFileName, 'utf8'));
  const converter = new Converter(source, !!opts.verbose);
  try {
    const resolved = converter.convert();
    if (outputFileName) {
      const format = outputFileName.endsWith('json') ? 'json' : 'yaml';
      const text = format === 'yaml' ? yaml.dump(resolved) : JSON.stringify(resolved, null, 2);
      const outDir = path.dirname(outputFileName);
      mkdirs(outDir);
      fs.writeFileSync(outputFileName, text, 'utf8');
    } else {
      const format = sourceFileName.endsWith('json') ? 'json' : 'yaml';
      const text = format === 'yaml' ? yaml.dump(resolved) : JSON.stringify(resolved, null, 2);
      console.log(text);
    }
  } catch (ex) {
    console.error(ex.message);
    process.exit(1);
  }
}

main(process.argv);
