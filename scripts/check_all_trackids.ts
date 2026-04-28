import { ECF, P12Reader, ENVIRONMENT } from 'dgii-ecf';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Mimic the exact variables from runner
const PASSWORD = process.env.CERTIFICATE_PASSWORD! || "123456";

async function run() {
    const p12Path = path.resolve(__dirname, '../cert.p12');
    const reader = new P12Reader(process.env.CERTIFICATE_PASSWORD || '');
    const certs = reader.getKeyFromFile(p12Path);
    const ecfApi = new ECF(certs, ENVIRONMENT.CERT);

    await ecfApi.authenticate();
    
    const trackIds = [
        '1ea14860-1a83-4d47-9035-ce72214c5d08',
        'bdc49ce0-97bd-4d02-8569-702a16316af5',
        '981a6125-935b-4609-9e97-e1000de04ff3',
        'b77c4d29-1550-4ef6-82f0-00ee05419f87',
        '954dd9a1-ba72-40da-a386-d0d208428d66',
        '745056d8-91f5-4357-af0a-fa61443cb9f6',
        'e5714ea1-2ceb-4ba5-ab9b-2cbb95c4c1e2',
        'ef509628-e8b3-4653-aaf3-c65d2cb66e0e',
        'c750b2fe-f01a-424b-b1a4-b7391a82d26b',
        'afdb6333-b938-42b4-890f-bbe09891f58a',
        '5faf104b-4d5a-427e-8791-af9b6a4f58bb',
        '72abb6b5-8811-4dbf-b773-021db4a6923d',
        '82783c06-6c34-4d7c-84fb-5ab8aac472be',
        'ec1bdd80-81cc-453f-8405-e8d0241750b2',
        'cfa29024-3ac8-41f6-bbc0-95671a027113',
        'a99b3f63-c55e-4b0b-bc38-84613fbebf63',
        'ed5f71ed-5e7f-4267-a004-f32f5fc00238',
        '4852c9ad-7398-4a33-934f-d15cfe05285c'
    ];
    
    for (const tid of trackIds) {
        try {
            const status = await ecfApi.statusTrackId(tid);
            console.log(`\n======== TrackID: ${tid} ========`);
            if (status && status.estado !== 'Aceptado') {
                 console.log(JSON.stringify(status, null, 2));
            } else {
                 console.log(status?.estado || 'Aceptado');
            }
        } catch (e: any) {
            console.log(`Error checking ${tid}: ${e.message}`);
        }
    }
}
run().catch(console.error);
