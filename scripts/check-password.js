import '../config/env.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

async function check() {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: 'test123@gmail.com' });
  console.log('User found:', !!user);
  console.log('Has password field:', !!user.password);
  console.log('Password hash length:', user.password?.length);
  console.log('Hash starts with:', user.password?.slice(0, 10));

  const match = await bcrypt.compare('newpass123', user.password);
  console.log('bcrypt.compare result:', match);

  await mongoose.connection.close();
  process.exit(0);
}

check().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
