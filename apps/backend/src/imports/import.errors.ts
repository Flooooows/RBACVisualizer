import { BadRequestException } from '@nestjs/common';
import type { ImportIssue } from './import.types';

export class ImportValidationException extends BadRequestException {
  constructor(
    message: string,
    public readonly issues: ImportIssue[],
  ) {
    super({
      message,
      issues,
    });
  }
}
