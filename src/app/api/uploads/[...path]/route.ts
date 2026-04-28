
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mime from 'mime';

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    const uploadRoot = path.join(process.cwd(), 'public', 'uploads');
    const sanitizedSegments = (params.path || []).filter(Boolean);
    const invalidSegment = sanitizedSegments.some((segment) =>
        segment.includes('..') ||
        segment.includes('/') ||
        segment.includes('\\') ||
        segment.includes('\0')
    );

    if (invalidSegment) {
        return new NextResponse('Invalid file path', { status: 400 });
    }

    const filePath = path.resolve(uploadRoot, ...sanitizedSegments);
    if (!filePath.startsWith(uploadRoot)) {
        return new NextResponse('Invalid file path', { status: 400 });
    }

    try {
        if (!fs.existsSync(filePath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const contentType = mime.getType(filePath) || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Error serving file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
