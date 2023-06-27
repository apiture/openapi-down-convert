#!/usr/bin/env node

/** Command Line interface for openapi-down-convert */

import * as fs from 'fs';

import { Command } from 'commander';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { version } from '../package.json';
import { Converter, ConverterOptions } from './converter';

async function main(args: string[] = process.argv) {
  const cli = new Command();
  cli
    .version(version)
    .usage('[options]')
    .option('-i, --input <input-file>', 'A OpenAPI 3.1 file name. Defaults to "openapi.yaml"')
    .option('-o, --output <output-file>', 'The output file, defaults to stdout if omitted')
    .option('-a, --allOf', 'If set, convert complex $ref in JSON schemas to allOf')
    .option('--authorizationUrl <authorizationUrl>', 'The authorizationUrl for openIdConnect -> oauth2 transformation')
    .option('--tokenUrl <tokenUrl>', 'The tokenUrl for openIdConnect -> oauth2 transformation')
    .option('-d, --delete-examples-with-id', 'If set, delete any JSON Schema examples that have an `id` property')
    .option('--oidc-to-oauth2 <scopes>', 'Convert openIdConnect security to oauth2 to allow scope definition')
    .option('-s, --scopes <scopes>', 'Alias for --oidc-to-oauth2')
    .option('-v, --verbose', 'Verbose output')
    .parse(args);
  const opts = cli.opts();
  const sourceFileName: string = opts.input || 'openapi.yaml';
  const outputFileName: string = opts.output;
  const source = yaml.load(fs.readFileSync(sourceFileName, 'utf8'));
  const cOpts: ConverterOptions = {
    verbose: Boolean(opts.verbose),
    deleteExampleWithId: Boolean(opts.deleteExamplesWithId),
    allOfTransform: Boolean(opts.allOf),
    authorizationUrl: opts.authorizationUrl,
    tokenUrl: opts.tokenUrl,
    scopeDescriptionFile: opts.scopes,
  };
  const converter = new Converter(source, cOpts);
  try {
    const resolved = converter.convert();
    if (outputFileName) {
      const format = outputFileName.endsWith('json') ? 'json' : 'yaml';
      const text = format === 'yaml' ? yaml.dump(resolved) : JSON.stringify(resolved, null, 2);
      const outDir = path.dirname(outputFileName);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, {recursive: true});
      }
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
