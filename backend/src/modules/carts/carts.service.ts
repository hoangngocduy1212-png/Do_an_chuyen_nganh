import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { CartItem } from '../cart-items/schemas/cart-item.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { Product } from '../products/schemas/product.schema';
import { Category } from '../categories/schemas/category.schema';
import { Store } from '../stores/schemas/store.schema';
import { AddCartItemDto } from './dto/cart.dto';
import { Cart } from './schemas/cart.schema';

export interface CartLineView {
  itemId: string;
  product: Record<string, unknown> | null;
  quantity: number;
  lineTotal: number;
  stock: number;
  priceAtAdd: number;
  currentPrice: number;
  priceChanged: boolean;
  available: boolean;
}

@Injectable()
export class CartsService {
  constructor(
    @InjectModel(Cart.name) private readonly carts: Model<Cart>,
    @InjectModel(CartItem.name) private readonly items: Model<CartItem>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Inventory.name) private readonly inventory: Model<Inventory>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Store.name) private readonly stores: Model<Store>,
  ) {}

  async get(userId: string) {
    const cart = await this.getCart(userId);
    const items = await this.items.find({ cartId: cart.cartId }).sort('createdAt').exec();
    const lines = await this.toLines(items, cart.storeId);
    return {
      storeId: cart.storeId,
      items: lines,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      totalAmount: lines.reduce((total, item) => total + item.lineTotal, 0),
    };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const { cart } = await this.getCartForUser(userId);
    const cartItems = await this.items.find({ cartId: cart.cartId }).exec();
    const storeId = dto.storeId ?? cart.storeId;
    if (!storeId) {
      throw new ConflictException({ code: 'VALIDATION_ERROR', message: 'Cần chọn cửa hàng trước khi thêm sản phẩm vào giỏ' });
    }
    if (cart.storeId && cart.storeId !== storeId && cartItems.length > 0) {
      throw new ConflictException({
        code: ErrorCode.CART_STORE_MISMATCH,
        message: 'Giỏ hàng đang gắn với cửa hàng khác. Hãy xóa giỏ cũ bằng DELETE /cart rồi thử lại.',
      });
    }
    const store = await this.stores.findOne({ storeId }).select('status').exec();
    if (!store || store.status !== 'ACTIVE') {
      throw new NotFoundException({ code: ErrorCode.STORE_NOT_FOUND, message: 'Không tìm thấy cửa hàng đang hoạt động' });
    }
    const product = await this.products.findOne({ productId: dto.productId }).exec();
    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Không tìm thấy sản phẩm đang bán' });
    }
    validateCartQuantity(product.unit, dto.quantity);
    const stock = await this.getStock(storeId, dto.productId);
    const existing = cartItems.find((item) => item.productId === dto.productId);
    const requestedTotal = (existing?.quantity ?? 0) + dto.quantity;
    const quantity = clampCartQuantity(product.unit, requestedTotal, stock);
    if (quantity <= (existing?.quantity ?? 0)) {
      throw new ConflictException({ code: ErrorCode.OUT_OF_STOCK, message: 'Sản phẩm đã hết tồn kho khả dụng tại cửa hàng' });
    }
    const currentPrice = getCurrentPrice(product);
    let item: HydratedDocument<CartItem>;
    if (existing) {
      existing.quantity = quantity;
      item = await existing.save();
    } else {
      item = await this.items.create({ cartId: cart.cartId, productId: dto.productId, quantity, price: currentPrice });
    }
    cart.storeId = storeId;
    await cart.save();
    const [line] = await this.toLines([item], storeId);
    await this.updateTotal(cart);
    return {
      ...line,
      totalAmount: cart.totalAmount,
      quantityAdjusted: quantity < requestedTotal,
      requestedQuantity: requestedTotal,
    };
  }

  async updateItem(userId: string, itemId: string, requestedQuantity: number) {
    const cart = await this.getCart(userId);
    const item = await this.items.findOne({ itemId, cartId: cart.cartId }).exec();
    if (!item) throw new NotFoundException({ code: ErrorCode.CART_ITEM_NOT_FOUND, message: 'Không tìm thấy sản phẩm trong giỏ hàng' });
    const product = await this.products.findOne({ productId: item.productId }).exec();
    if (!product || product.status !== 'ACTIVE' || !cart.storeId) {
      throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Không tìm thấy sản phẩm đang bán trong giỏ hàng' });
    }
    validateCartQuantity(product.unit, requestedQuantity);
    const stock = await this.getStock(cart.storeId, item.productId);
    const quantity = clampCartQuantity(product.unit, requestedQuantity, stock);
    if (quantity <= 0) throw new ConflictException({ code: ErrorCode.OUT_OF_STOCK, message: 'Sản phẩm đã hết tồn kho khả dụng tại cửa hàng' });
    item.quantity = quantity;
    await item.save();
    await this.updateTotal(cart);
    return { ...(await this.get(userId)), quantityAdjusted: quantity !== requestedQuantity, requestedQuantity };
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getCart(userId);
    const result = await this.items.deleteOne({ itemId, cartId: cart.cartId }).exec();
    if (!result.deletedCount) throw new NotFoundException({ code: ErrorCode.CART_ITEM_NOT_FOUND, message: 'Không tìm thấy sản phẩm trong giỏ hàng' });
    if (await this.items.countDocuments({ cartId: cart.cartId }).exec() === 0) cart.storeId = undefined;
    await this.updateTotal(cart);
    return this.get(userId);
  }

  async clear(userId: string) {
    const cart = await this.getCart(userId);
    await this.items.deleteMany({ cartId: cart.cartId }).exec();
    cart.storeId = undefined;
    cart.totalAmount = 0;
    await cart.save();
    return { storeId: null, items: [], totalItems: 0, totalAmount: 0 };
  }

  async validate(userId: string) {
    const cart = await this.getCart(userId);
    const items = await this.items.find({ cartId: cart.cartId }).exec();
    const lines = await this.toLines(items, cart.storeId);
    const changes = lines.filter((line) => !line.available || line.priceChanged || line.quantity > line.stock)
      .map((line) => ({
        itemId: line.itemId,
        productId: String(line.product?.productId ?? ''),
        productName: String(line.product?.productName ?? line.product?.name ?? ''),
        type: !line.available ? 'UNAVAILABLE' : line.quantity > line.stock ? 'QUANTITY' : 'PRICE',
        message: !line.available ? 'Sản phẩm hiện không khả dụng' : line.quantity > line.stock ? 'Số lượng vượt tồn kho' : 'Giá sản phẩm đã thay đổi',
        availableStock: line.stock,
        currentPrice: line.currentPrice,
        suggestedQuantity: clampCartQuantity(String(line.product?.unit ?? ''), line.quantity, line.stock),
      }));
    return { storeId: cart.storeId, valid: changes.length === 0, changes };
  }

  private async getCart(userId: string) {
    return (await this.getCartForUser(userId)).cart;
  }

  private async getCartForUser(userId: string): Promise<{ cart: HydratedDocument<Cart> }> {
    const customer = await this.customers.findOne({ userId }).select('customerId').exec();
    if (!customer) throw new NotFoundException({ code: ErrorCode.CUSTOMER_NOT_FOUND, message: 'Không tìm thấy hồ sơ khách hàng' });
    const customerId = customer.customerId;
    const cart = await this.carts.findOneAndUpdate(
      { customerId },
      { $setOnInsert: { customerId, totalAmount: 0 } },
      { new: true, upsert: true },
    ).exec();
    return { cart };
  }

  private async getStock(storeId: string, productId: string): Promise<number> {
    const inventory = await this.inventory.findOne({ storeId, productId }).select('quantity reservedQuantity').lean().exec();
    return inventory ? Math.max(0, inventory.quantity - (inventory.reservedQuantity ?? 0)) : 0;
  }

  private async toLines(items: HydratedDocument<CartItem>[], storeId?: string): Promise<CartLineView[]> {
    if (items.length === 0) return [];
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.products.find({ productId: { $in: productIds } }).exec();
    const productById = new Map(products.map((product) => [product.productId, product]));
    const stockRows = storeId
      ? await this.inventory.find({ storeId, productId: { $in: productIds } }).select('productId quantity reservedQuantity').lean().exec()
      : [];
    const stockById = new Map(stockRows.map((row) => [row.productId, Math.max(0, row.quantity - (row.reservedQuantity ?? 0))]));
    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const categories = await this.categories.find({ categoryId: { $in: categoryIds } }).select('categoryId categoryName').exec();
    const categoryById = new Map(categories.map((category) => [category.categoryId, category.categoryName]));

    return items.map((item) => {
      const product = productById.get(item.productId);
      const stock = stockById.get(item.productId) ?? 0;
      const currentPrice = product ? getCurrentPrice(product) : 0;
      const productJson = product?.toJSON() as Record<string, unknown> | undefined;
      const available = Boolean(product && product.status === 'ACTIVE' && item.quantity <= stock);
      return {
        itemId: item.itemId,
        product: product ? {
          ...productJson,
          name: product.productName,
          imageUrl: product.image,
          categoryName: categoryById.get(product.categoryId) ?? '',
          ...(product.salePrice && isSaleActive(product) ? {} : { salePrice: undefined }),
          stock,
        } : null,
        quantity: item.quantity,
        lineTotal: currentPrice * item.quantity,
        stock,
        priceAtAdd: item.price,
        currentPrice,
        priceChanged: item.price !== currentPrice,
        available,
      };
    });
  }

  private async updateTotal(cart: HydratedDocument<Cart>): Promise<void> {
    const items = await this.items.find({ cartId: cart.cartId }).exec();
    const lines = await this.toLines(items, cart.storeId);
    cart.totalAmount = lines.reduce((total, item) => total + item.lineTotal, 0);
    await cart.save();
  }
}

function isWeighted(unit: string): boolean {
  return unit.trim().toLowerCase() === 'kg';
}

export function validateCartQuantity(unit: string, quantity: number): void {
  const valid = isWeighted(unit)
    ? Number.isInteger(quantity * 2) && quantity >= 0.5
    : Number.isInteger(quantity) && quantity >= 1;
  if (!valid) {
    throw new ConflictException({
      code: ErrorCode.INVALID_QUANTITY,
      message: isWeighted(unit) ? 'Sản phẩm cân phải có số lượng là bội số 0,5 kg' : 'Số lượng sản phẩm phải là số nguyên từ 1 trở lên',
    });
  }
}

export function clampCartQuantity(unit: string, quantity: number, stock: number): number {
  const capped = Math.min(quantity, stock);
  return isWeighted(unit) ? Math.floor(capped * 2) / 2 : Math.floor(capped);
}

function isSaleActive(product: Product): boolean {
  const now = new Date();
  return typeof product.salePrice === 'number' && Boolean(product.saleStartDate && product.saleEndDate)
    && product.saleStartDate! <= now && product.saleEndDate! >= now;
}

function getCurrentPrice(product: Product): number {
  return isSaleActive(product) ? product.salePrice! : product.price;
}
