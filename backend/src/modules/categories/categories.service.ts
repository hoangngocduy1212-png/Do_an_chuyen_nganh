import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoriesService {
  constructor(@InjectModel(Category.name) private model: Model<CategoryDocument>) {}

  findAll() {
    return this.model.find().sort('categoryName');
  }

  create(dto: CreateCategoryDto) {
    return this.model.create(dto);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true });
    if (!doc) throw new NotFoundException('Khong tim thay danh muc');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Khong tim thay danh muc');
    return { deleted: true };
  }
}
