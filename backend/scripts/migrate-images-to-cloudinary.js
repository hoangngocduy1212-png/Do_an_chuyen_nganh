// Chay: node --env-file=../.env scripts/migrate-images-to-cloudinary.js
// Day cac anh /uploads/* len Cloudinary va cap nhat truong image trong MongoDB.
const { MongoClient } = require('mongodb');
const { v2: cloudinary } = require('cloudinary');
const { existsSync } = require('fs');
const { basename, join } = require('path');

async function main() {
  if (!process.env.CLOUDINARY_URL) throw new Error('Thieu CLOUDINARY_URL trong .env');
  cloudinary.config({ secure: true });
  const client = await MongoClient.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const products = client.db().collection('products');
  const uploads = join(__dirname, '..', 'uploads');
  let done = 0;
  for (const p of await products.find({ image: /^\/uploads\// }).toArray()) {
    const file = join(uploads, basename(p.image));
    if (!existsSync(file)) { console.log('bo qua (khong co file):', p.image); continue; }
    const res = await cloudinary.uploader.upload(file, { folder: 'supermarket/products' });
    await products.updateOne({ _id: p._id }, { $set: { image: res.secure_url } });
    done += 1;
    console.log('OK', p.productName, '->', res.secure_url);
  }
  console.log(`Hoan tat: ${done} anh`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
