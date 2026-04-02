import { parseImportRequest } from './import.parser';

describe('parseImportRequest', () => {
  it('parses multi-document YAML payloads', () => {
    const parsed = parseImportRequest(
      [
        'apiVersion: v1',
        'kind: ServiceAccount',
        'metadata:',
        '  name: default',
        '  namespace: demo',
        '---',
        'apiVersion: rbac.authorization.k8s.io/v1',
        'kind: Role',
        'metadata:',
        '  name: reader',
        '  namespace: demo',
        'rules:',
        '  - verbs: ["get"]',
        '    resources: ["pods"]',
      ].join('\n'),
      'application/yaml',
    );

    expect(parsed.sourceType).toBe('YAML');
    expect(parsed.documents).toHaveLength(2);
    expect(parsed.documents[0].metadataRef.kind).toBe('ServiceAccount');
    expect(parsed.documents[1].metadataRef.kind).toBe('Role');
  });

  it('parses JSON list wrappers', () => {
    const parsed = parseImportRequest({
      kind: 'List',
      items: [
        {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRole',
          metadata: { name: 'view' },
          rules: [],
        },
      ],
    });

    expect(parsed.sourceType).toBe('JSON');
    expect(parsed.documents).toHaveLength(1);
    expect(parsed.documents[0].metadataRef.kind).toBe('ClusterRole');
  });
});
