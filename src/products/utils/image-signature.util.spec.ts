import { detectImageType } from './image-signature.util';

describe('detectImageType', () => {
  it('detects JPEG', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    expect(detectImageType(buffer)).toEqual({
      extension: 'jpg',
      contentType: 'image/jpeg',
    });
  });

  it('detects PNG', () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);

    expect(detectImageType(buffer)?.extension).toBe('png');
  });

  it('detects WebP', () => {
    const buffer = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP', 'ascii'),
    ]);

    expect(detectImageType(buffer)?.extension).toBe('webp');
  });

  it('rejects GIF, SVG, text and empty files', () => {
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageType(Buffer.from('<svg xmlns="x"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('hello world, not an image'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects files that are too short to carry a signature', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(Buffer.from('RIFF'))).toBeNull();
  });

  it('does not accept RIFF files that are not WebP', () => {
    const buffer = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE', 'ascii'),
    ]);

    expect(detectImageType(buffer)).toBeNull();
  });
});