import { BadRequestException } from '@nestjs/common';

import { assertNoNullFields } from './assert-no-null-fields.util';

describe('assertNoNullFields', () => {
  it('passes when no field is null', () => {
    expect(() => assertNoNullFields({ name: 'A', age: 3 })).not.toThrow();
  });

  it('ignores undefined values', () => {
    expect(() => assertNoNullFields({ name: undefined })).not.toThrow();
  });

  it('allows null for the listed nullable fields', () => {
    expect(() =>
      assertNoNullFields({ avatar: null }, ['avatar']),
    ).not.toThrow();
  });

  it('throws BadRequestException listing every non-nullable null field', () => {
    const call = () =>
      assertNoNullFields({ email: null, firstName: null, avatar: null }, [
        'avatar',
      ]);

    expect(call).toThrow(BadRequestException);
    expect(call).toThrow('email, firstName');
  });
});