import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { parseDocument } from 'yaml';

/**
 * Loads docs/api/openapi.yaml (the single source of truth) and compiles Ajv validators
 * for the response schemas. Nothing here is hand-copied from the contract.
 */
type JsonSchema = Record<string, unknown>;
interface OpenApiDoc {
  components: { schemas: Record<string, JsonSchema> };
}

const specPath = fileURLToPath(new URL('../../../docs/api/openapi.yaml', import.meta.url));
const specText = readFileSync(specPath, 'utf8');

/** Parse the whole contract; any YAML error fails the run instead of being worked around. */
function loadContract(): OpenApiDoc {
  const full = parseDocument(specText);
  if (full.errors.length > 0) {
    const first = full.errors[0]?.message.split('\n')[0] ?? 'unknown error';
    throw new Error(`docs/api/openapi.yaml is not valid YAML: ${first}`);
  }
  return full.toJS() as OpenApiDoc;
}

const doc = loadContract();
const schemas = structuredClone(doc.components.schemas);

function schema(name: string): JsonSchema {
  const s = schemas[name];
  if (!s) throw new Error(`Schema ${name} missing from openapi.yaml`);
  return s;
}

// Book is `allOf: [BookInput, {id, available, createdAt}]`, but BookInput has
// `additionalProperties: false`, which would make allOf reject `id`. For responses we
// flatten both parts into one closed object: every documented field, nothing extra.
const bookInput = schema('BookInput');
const bookAllOf = schema('Book').allOf as JsonSchema[];
const bookExtras = bookAllOf.find((part) => !('$ref' in part));
if (!bookExtras) throw new Error('Unexpected Book schema shape in openapi.yaml');
schemas.Book = {
  type: 'object',
  additionalProperties: false,
  required: [...(bookInput.required as string[]), ...(bookExtras.required as string[])],
  properties: {
    ...(bookInput.properties as JsonSchema),
    ...(bookExtras.properties as JsonSchema),
  },
};

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'openapi.json', components: { schemas } });

export type SchemaName = 'Book' | 'BookPage' | 'Problem';

const validators = new Map<SchemaName, ValidateFunction>();
export function validatorFor(name: SchemaName): ValidateFunction {
  let v = validators.get(name);
  if (!v) {
    v = ajv.compile({ $ref: `openapi.json#/components/schemas/${name}` });
    validators.set(name, v);
  }
  return v;
}

export function schemaErrors(name: SchemaName, body: unknown): string | null {
  const v = validatorFor(name);
  return v(body) ? null : ajv.errorsText(v.errors, { dataVar: name });
}

export const GENRES = (schema('Genre').enum as string[]).slice();
