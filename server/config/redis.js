const setupRedisAdapter = async (io) => {
    try {
        // Always try to setup Redis adapter in production OR if Redis URL is provided
        // This ensures the fix works even if NODE_ENV isn't explicitly set to production
        if (process.env.REDIS_URL || process.env.NODE_ENV === 'production') {
            const { createAdapter } = require('@socket.io/redis-adapter');
            const { createClient } = require('redis');

            console.log('🔄 Setting up Redis adapter for Socket.IO scaling...');
            console.log('🔧 Environment: NODE_ENV=' + process.env.NODE_ENV + ', REDIS_URL=' + process.env.REDIS_URL);

            // Use REDIS_URL if provided, otherwise use localhost with password
            let redisConfig;
            if (process.env.REDIS_URL) {
                // Parse the REDIS_URL (e.g., redis://127.0.0.1:6379)
                redisConfig = {
                    url: process.env.REDIS_URL
                };

                // Add password if provided separately
                if (process.env.REDIS_PASSWORD) {
                    redisConfig.password = process.env.REDIS_PASSWORD;
                }
            } else {
                // Fallback to manual configuration
                redisConfig = {
                    socket: {
                        host: '127.0.0.1',
                        port: 6379
                    }
                };

                // Add password if provided
                if (process.env.REDIS_PASSWORD) {
                    redisConfig.password = process.env.REDIS_PASSWORD;
                }
            }

            console.log('🔧 Redis config:', { ...redisConfig, password: redisConfig.password ? '[HIDDEN]' : 'none' });

            const pubClient = createClient(redisConfig);
            const subClient = pubClient.duplicate();

            // Add connection event handlers before connecting
            pubClient.on('connect', () => {
                console.log('✅ Redis PubClient connected');
            });

            subClient.on('connect', () => {
                console.log('✅ Redis SubClient connected');
            });

            pubClient.on('ready', () => {
                console.log('🚀 Redis PubClient ready');
            });

            subClient.on('ready', () => {
                console.log('🚀 Redis SubClient ready');
            });

            // Connect to Redis
            console.log('🔌 Connecting to Redis...');
            await pubClient.connect();
            await subClient.connect();

            // Set up the adapter
            const adapter = createAdapter(pubClient, subClient);
            io.adapter(adapter);

            console.log('✅ Redis adapter connected successfully - Socket.IO scaling enabled');
            console.log('🎯 Multiple server instances can now share game state');

            // Handle Redis connection errors gracefully
            pubClient.on('error', (err) => {
                console.error('❌ Redis Pub Client Error:', err);
                console.log('⚠️  Falling back to memory adapter for this instance');
            });

            subClient.on('error', (err) => {
                console.error('❌ Redis Sub Client Error:', err);
                console.log('⚠️  Falling back to memory adapter for this instance');
            });

            return { pubClient, subClient };
        } else {
            console.log('⚠️  Redis adapter not configured - using memory adapter (single instance mode)');
            console.log('💡 To enable Redis scaling, set REDIS_URL or NODE_ENV=production');
            return null;
        }
    } catch (error) {
        console.error('❌ Redis adapter setup failed:', error.message);
        console.error('❌ Stack trace:', error.stack);
        console.log('⚠️  Falling back to memory adapter - Socket.IO will work but may have scaling issues');
        console.log('🔧 Debug info - NODE_ENV:', process.env.NODE_ENV, 'REDIS_URL:', process.env.REDIS_URL);
        return null;
    }
};

module.exports = { setupRedisAdapter };
