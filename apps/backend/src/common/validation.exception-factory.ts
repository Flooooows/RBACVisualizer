import { BadRequestException, ValidationError } from '@nestjs/common';

function flattenErrors(
  errors: ValidationError[],
  parentPath?: string,
): Array<{ field: string; messages: string[] }> {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const current = error.constraints
      ? [
          {
            field,
            messages: Object.values(error.constraints),
          },
        ]
      : [];

    const children =
      error.children && error.children.length > 0 ? flattenErrors(error.children, field) : [];

    return [...current, ...children];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    errors: flattenErrors(errors),
  });
}
