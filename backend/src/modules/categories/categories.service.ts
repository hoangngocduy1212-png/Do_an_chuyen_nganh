import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
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
    const doc = await this.model.findOneAndUpdate(this.idFilter(id), dto, { new: true, runValidators: true });
    if (!doc) throw new NotFoundException('Khong tim thay danh muc');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findOneAndDelete(this.idFilter(id));
    if (!doc) throw new NotFoundException('Khong tim thay danh muc');
    return { deleted: true };
  }

  private idFilter(id: string) {
    return Types.ObjectId.isValid(id)
      ? { $or: [{ categoryId: id }, { _id: new Types.ObjectId(id) }] }
      : { categoryId: id };
  }
}
