import '../config/env.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

async function resetPassword() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const hash = await bcrypt.hash('newpass123', 12);
  console.log('New hash:', hash);

  const result = await User.updateOne(
    { email: 'test123@gmail.com' },
    { $set: { password: hash } }
  );

  console.log('Matched:', result.matchedCount);
  console.log('Modified:', result.modifiedCount);

  await mongoose.connection.close();
  process.exit(0);
}

resetPassword().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
