import { BadRequestException, Body, Controller, Get, MaxFileSizeValidator, Param, ParseFilePipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { Role } from '../../common/constants/roles';
import { ErrorCode } from '../../common/constants/error-codes';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

const imageStorage = diskStorage({
  destination: (_request, _file, callback) => {
    const directory = join(process.cwd(), 'uploads');
    mkdirSync(directory, { recursive: true });
    callback(null, directory);
  },
  filename: (_request, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
});

function imageFileFilter(_request: unknown, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void): void {
  const allowedExtensions: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  };
  const extensions = allowedExtensions[file.mimetype];
  if (!extensions || !extensions.includes(extname(file.originalname).toLowerCase())) {
    callback(new BadRequestException({ code: ErrorCode.INVALID_IMAGE_TYPE, message: 'Ảnh phải có định dạng JPG, PNG hoặc WebP' }), false);
    return;
  }
  callback(null, true);
}

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Query() query: ProductQueryDto, @CurrentUser() user?: AuthUser) {
    if (query.limit > 50) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'limit không được vượt quá 50' });
    return this.products.findAll(query, user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Query('storeId') storeId: string | undefined, @CurrentUser() user?: AuthUser) {
    return this.products.findOne(id, storeId, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post()
  @UseInterceptors(FileInterceptor('image', { storage: imageStorage, fileFilter: imageFileFilter, limits: { fileSize: 2 * 1024 * 1024 } }))
  create(
    @Body() dto: CreateProductDto,
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })], fileIsRequired: false }))
    image?: Express.Multer.File,
  ) {
    return this.products.create({ ...dto, image: image ? `/uploads/${image.filename}` : dto.image });
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { storage: imageStorage, fileFilter: imageFileFilter, limits: { fileSize: 2 * 1024 * 1024 } }))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })], fileIsRequired: false }))
    image?: Express.Multer.File,
  ) {
    return this.products.update(id, { ...dto, ...(image ? { image: `/uploads/${image.filename}` } : {}) });
  }
}
