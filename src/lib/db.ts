import mongoose from 'mongoose';

type ConnectionObject = {
    isConnected?: number;
};

const connection: ConnectionObject = {};

async function dbConnect(): Promise<void> {
    if (mongoose.connections.length > 0) {
        if (mongoose.connections[0].readyState === 1) {
            // console.log('Already connected to database');
            return;
        }
        await mongoose.disconnect();
    }

    if (!process.env.MONGODB_URI) {
        console.warn('MONGODB_URI not defined. Skipping database connection (likely build time).');
        return;
    }

    try {
        console.log("Attempting to connect to MongoDB...");
        // Mask password in logs
        const uriLog = (process.env.MONGODB_URI || '').replace(/:([^:@]+)@/, ':****@');
        console.log(`Connection URI: ${uriLog}`);

        const db = await mongoose.connect(process.env.MONGODB_URI || '', {
            dbName: 'zarela_erp',
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000, // Fail fast for debugging
        });

        connection.isConnected = db.connections[0].readyState;

        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error);
    }
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
