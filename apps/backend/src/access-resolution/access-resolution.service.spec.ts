import { SubjectKind } from '@prisma/client';
import { AccessResolutionService } from './access-resolution.service';

describe('AccessResolutionService', () => {
  it('builds stable subject node ids', () => {
    const service = new AccessResolutionService({} as never);

    expect(
      (
        service as unknown as {
          buildSubjectNodeId(subject: {
            id: string;
            kind: SubjectKind;
            name: string;
            namespace: string | null;
          }): string;
        }
      ).buildSubjectNodeId({
        id: '1',
        kind: SubjectKind.USER,
        name: 'alice',
        namespace: null,
      }),
    ).toBe('subject:user:alice');
  });
});
