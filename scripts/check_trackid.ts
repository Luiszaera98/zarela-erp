import { ECF } from 'dgii-ecf';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const ecfApi = new ECF(
        {
            p12Path: process.env.CERTIFICATE_PATH || '',
            p12Password: process.env.CERTIFICATE_PASSWORD || '',
            environment: process.env.ENVIRONMENT || 'https://ecf.dgii.gov.do',
        },
        '132327179'
    );
    await ecfApi.authenticate();
    
    // Check TrackID for E32...0006 from the latest output
    const trackId = '1ea14860-1a83-4d47-9035-ce72214c5d08';
    try {
        const status = await ecfApi.statusTrackId(trackId);
        console.log(`TrackID ${trackId} Status:`);
        console.log(JSON.stringify(status, null, 2));
    } catch (err: any) {
        console.log(`Failed to get status: ${err.message}`);
    }
}
run().catch(console.error);
