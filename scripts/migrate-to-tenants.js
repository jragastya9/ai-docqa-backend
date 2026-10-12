import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

async function migrate() {
  await connectDB();

  console.log('🔍 Finding users without tenant...');
  const usersWithoutTenant = await User.find({
    $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
  });

  console.log(`Found ${usersWithoutTenant.length} users to migrate\n`);

  for (const user of usersWithoutTenant) {
    console.log(`📦 Migrating: ${user.email}`);

    const slugBase = (user.name || user.email)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const tenant = await Tenant.create({
      name: `${user.name || 'User'}'s Workspace`,
      slug,
      ownerId: user._id,
    });

    user.tenantId = tenant._id;
    user.role = 'owner';
    await user.save({ validateBeforeSave: false });

    await Document.updateMany(
      { userId: user._id },
      { $set: { tenantId: tenant._id } }
    );
    await Chunk.updateMany(
      { userId: user._id },
      { $set: { tenantId: tenant._id } }
    );
    await Conversation.updateMany(
      { userId: user._id },
      { $set: { tenantId: tenant._id } }
    );
    await Message.updateMany(
      { userId: user._id },
      { $set: { tenantId: tenant._id } }
    );

    console.log(`  ✅ Tenant: ${slug}\n`);
  }

  console.log('🎉 Migration complete');
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});