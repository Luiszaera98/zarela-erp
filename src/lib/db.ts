import mongoose from 'mongoose';

type MongooseCache = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

declare global {
    // eslint-disable-next-line no-var
    var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || {
    conn: null,
    promise: null,
};

if (!global.mongooseCache) {
    global.mongooseCache = cached;
}

function maskMongoUri(uri: string) {
    return uri.replace(/:([^:@]+)@/, ':****@');
}

function getConnectionUris() {
    const primaryUri = process.env.MONGODB_URI;
    if (!primaryUri) {
        throw new Error('MONGODB_URI no está definida. No se puede conectar a MongoDB.');
    }

    const uris = [primaryUri];
    const isLocalRuntime = process.env.NODE_ENV !== 'production';
    if (isLocalRuntime && primaryUri.includes('@mongodb:27017')) {
        uris.push(primaryUri.replace('@mongodb:27017', '@127.0.0.1:27018'));
    } else if (isLocalRuntime && primaryUri.includes('//mongodb:27017')) {
        uris.push(primaryUri.replace('//mongodb:27017', '//127.0.0.1:27018'));
    }

    return Array.from(new Set(uris));
}

async function connectWithFallback() {
    const uris = getConnectionUris();
    let lastError: unknown;

    for (const uri of uris) {
        try {
            console.log("Attempting to connect to MongoDB...");
            console.log(`Connection URI: ${maskMongoUri(uri)}`);

            const mongooseInstance = await mongoose.connect(uri, {
                dbName: 'zarela_erp',
                bufferCommands: false,
                serverSelectionTimeoutMS: 5000,
            });

            console.log('Database connected successfully');
            return mongooseInstance;
        } catch (error: any) {
            lastError = error;
            console.error(`Database connection failed for ${maskMongoUri(uri)}:`, error?.message || error);
        }
    }

    throw lastError instanceof Error ? lastError : new Error('No se pudo conectar a MongoDB.');
}

async function dbConnect(): Promise<void> {
    if (cached.conn && mongoose.connection.readyState === 1) {
        return;
    }

    if (!cached.promise) {
        cached.promise = connectWithFallback().catch((error) => {
            cached.promise = null;
            throw error;
        });
    }

    cached.conn = await cached.promise;
}

export default dbConnect;

export async function runTransaction<T>(
    operation: (session?: mongoose.ClientSession) => Promise<T>
): Promise<T> {
    const session = await mongoose.startSession();
    let transactionStarted = false;

    try {
        session.startTransaction();
        transactionStarted = true;

        const result = await operation(session);

        await session.commitTransaction();
        return result;
    } catch (error: any) {
        if (transactionStarted) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                // Ignore abort errors (e.g. if transaction never really started on server)
            }
        }

        // Check for replica set required error
        if (
            error.message?.includes('replica set') ||
            error.message?.includes('Transaction numbers') ||
            (error.code === 20 && error.codeName === 'IllegalOperation')
        ) {
            console.warn('Transactions not supported (Not Replica Set). Retrying without transaction.');
            // Retry the operation without a session
            return await operation(undefined);
        }

        throw error;
    } finally {
        await session.endSession();
    }
}
