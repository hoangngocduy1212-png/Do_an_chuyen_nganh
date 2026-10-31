import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

@Injectable()
export class ImageStorageService {
  private readonly logger = new Logger(ImageStorageService.name);
  private readonly useCloud = Boolean(process.env.CLOUDINARY_URL);

  constructor() {
    if (this.useCloud) cloudinary.config({ secure: true });
  }

  async save(file: { buffer: Buffer; originalname: string }): Promise<string> {
    if (this.useCloud) {
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'supermarket/products', resource_type: 'image' }, (error, value) => {
          if (error || !value) reject(error ?? new Error('Cloudinary upload failed'));
          else resolve(value);
        }).end(file.buffer);
      });
      return result.secure_url;
    }
    this.logger.warn('CLOUDINARY_URL chưa cấu hình, lưu ảnh vào thư mục uploads cục bộ');
    const directory = join(process.cwd(), 'uploads');
    mkdirSync(directory, { recursive: true });
    const filename = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
    writeFileSync(join(directory, filename), file.buffer);
    return `/uploads/${filename}`;
  }
}
