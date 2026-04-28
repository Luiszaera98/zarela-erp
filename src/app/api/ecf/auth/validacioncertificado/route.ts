import { NextResponse } from 'next/server';

export async function GET() {
  return handleRequest();
}

export async function POST() {
  return handleRequest();
}

async function handleRequest() {
  const token = "DGII-TEST-TOKEN-" + Math.random().toString(36).substring(7);
  const now = new Date();
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 1);

  const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<RespuestaAutenticacion>
  <token>${token}</token>
  <expira>${expiration.toISOString()}</expira>
  <expedido>${now.toISOString()}</expedido>
</RespuestaAutenticacion>`;

  return new NextResponse(xmlResponse, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
