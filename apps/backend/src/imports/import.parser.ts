import { parseAllDocuments } from 'yaml';
import { ImportValidationException } from './import.errors';
import type {
  ImportEnvelope,
  ImportIssue,
  ImportSourceType,
  ParsedImportRequest,
  ParsedManifestDocument,
} from './import.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnvelope(value: unknown): value is ImportEnvelope {
  return (
    isRecord(value) &&
    ('raw' in value || 'manifests' in value || 'sourceType' in value || 'sourceLabel' in value)
  );
}

function flattenInput(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items;
  }

  return [value];
}

function metadataFromManifest(
  manifest: Record<string, unknown>,
  index: number,
): ParsedManifestDocument['metadataRef'] {
  const apiVersion = typeof manifest.apiVersion === 'string' ? manifest.apiVersion : '';
  const kind = typeof manifest.kind === 'string' ? manifest.kind : '';
  const metadata = isRecord(manifest.metadata) ? manifest.metadata : null;
  const name = metadata && typeof metadata.name === 'string' ? metadata.name : '';
  const namespace = metadata && typeof metadata.namespace === 'string' ? metadata.namespace : null;

  return {
    apiVersion,
    kind,
    name: name || `manifest-${index}`,
    namespace,
  };
}

function parseYamlDocuments(raw: string): Record<string, unknown>[] {
  const docs = parseAllDocuments(raw);
  const issues: ImportIssue[] = [];

  docs.forEach((document, index) => {
    if (document.errors.length > 0) {
      issues.push({
        code: 'INVALID_YAML',
        severity: 'ERROR',
        message: document.errors.map((error) => error.message).join('; '),
        manifestIndex: index,
      });
    }
  });

  if (issues.length > 0) {
    throw new ImportValidationException('Invalid YAML payload.', issues);
  }

  return docs
    .map((document) => document.toJS())
    .filter(
      (value): value is Record<string, unknown> | Record<string, unknown>[] =>
        value !== null && value !== undefined,
    )
    .flatMap((value) => flattenInput(value))
    .filter((value): value is Record<string, unknown> => isRecord(value));
}

function parseJsonDocuments(value: unknown): Record<string, unknown>[] {
  return flattenInput(value)
    .map((item) => {
      if (!isRecord(item)) {
        throw new ImportValidationException('Invalid JSON payload.', [
          {
            code: 'INVALID_JSON',
            severity: 'ERROR',
            message: 'Each manifest must be a JSON object.',
          },
        ]);
      }

      if (item.kind === 'List' && Array.isArray(item.items)) {
        return item.items;
      }

      return item;
    })
    .flatMap((item) => flattenInput(item))
    .filter((value): value is Record<string, unknown> => isRecord(value));
}

export function parseImportRequest(body: unknown, contentType?: string): ParsedImportRequest {
  if (body === undefined || body === null || body === '') {
    throw new ImportValidationException('Import body is required.', [
      {
        code: 'INVALID_BODY',
        severity: 'ERROR',
        message: 'Provide JSON manifests or raw YAML/JSON text.',
      },
    ]);
  }

  let sourceLabel: string | null = null;
  let sourceType: ImportSourceType = 'JSON';
  let documents: Record<string, unknown>[] = [];

  if (typeof body === 'string') {
    sourceType = contentType?.includes('json') ? 'JSON' : 'YAML';
    documents = parseYamlDocuments(body);
  } else if (isEnvelope(body)) {
    sourceLabel = typeof body.sourceLabel === 'string' ? body.sourceLabel : null;
    sourceType = body.sourceType ?? 'JSON';

    if (typeof body.raw === 'string') {
      sourceType = body.sourceType ?? (contentType?.includes('json') ? 'JSON' : 'YAML');
      documents = parseYamlDocuments(body.raw);
    } else if (body.manifests !== undefined) {
      documents = parseJsonDocuments(body.manifests);
      sourceType = body.sourceType ?? 'JSON';
    } else {
      throw new ImportValidationException('Import envelope requires raw or manifests.', [
        {
          code: 'INVALID_BODY',
          severity: 'ERROR',
          message: 'Provide raw text or manifests in the request body.',
        },
      ]);
    }
  } else if (Array.isArray(body) || isRecord(body)) {
    documents = parseJsonDocuments(body);
    sourceType = 'JSON';
  } else {
    throw new ImportValidationException('Unsupported import body.', [
      {
        code: 'INVALID_BODY',
        severity: 'ERROR',
        message: 'Body must be raw text, a manifest object, an array, or an import envelope.',
      },
    ]);
  }

  if (documents.length === 0) {
    throw new ImportValidationException('No manifests found in request.', [
      {
        code: 'INVALID_BODY',
        severity: 'ERROR',
        message: 'The import did not contain any manifest documents.',
      },
    ]);
  }

  return {
    sourceType,
    sourceLabel,
    documents: documents.map((manifest, index) => ({
      index,
      sourceType,
      metadataRef: metadataFromManifest(manifest, index),
      manifest,
    })),
  };
}
