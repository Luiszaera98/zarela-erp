import { NextResponse } from 'next/server';

export async function GET() {
  return handleRequest();
}

export async function POST() {
  return handleRequest();
}

async function handleRequest() {
  const semilla = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const now = new Date().toISOString();
  
  const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<SemillaModel xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <valor>${semilla}</valor>
  <fecha>${now}</fecha>
</SemillaModel>`;

  return new NextResponse(xmlResponse, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
