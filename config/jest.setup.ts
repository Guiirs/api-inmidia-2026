process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/backend-test';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false';
