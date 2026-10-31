import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { ChatService } from './chat.service';

export class SendMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) content: string;
  @IsOptional() @IsString() storeId?: string;
}

export class SendImagesDto {
  @IsOptional() @IsString() @MaxLength(500) content?: string;
  @IsOptional() @IsString() storeId?: string;
}

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat/sessions')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(@CurrentUser() user?: AuthUser) {
    return this.chat.createSession(user);
  }

  @Roles(Role.CUSTOMER)
  @Get('my')
  mine(@CurrentUser() user: AuthUser) {
    return this.chat.mine(user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/messages')
  send(@Param('id') id: string, @Body() dto: SendMessageDto, @CurrentUser() user?: AuthUser) {
    return this.chat.sendMessage(id, dto.content.trim(), dto.storeId, user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 4, {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(/^image\/(jpeg|png|webp)$/.test(file.mimetype) ? null : new BadRequestException('Chỉ nhận ảnh JPG, PNG, WEBP'), /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
  }))
  sendImages(
    @Param('id') id: string,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>,
    @Body() dto: SendImagesDto,
    @CurrentUser() user?: AuthUser,
  ) {
    if (!files?.length) throw new BadRequestException('Cần ít nhất 1 ảnh');
    return this.chat.sendImages(id, files, (dto.content ?? '').trim(), dto.storeId, user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/messages')
  history(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.chat.history(id, user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/handover')
  handover(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.chat.handover(id, user);
  }
}
