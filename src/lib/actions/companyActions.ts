"use server";

export interface CompanyInfo {
    name: string;
    rnc: string;
    address: string;
    phone: string;
    email: string;
    instagram?: string;
}

export async function getCompanyInfo(): Promise<CompanyInfo> {
    return {
        name: process.env.ECF_RAZON_SOCIAL || process.env.COMPANY_NAME || 'Zarela ERP',
        rnc: process.env.ECF_RNC_EMISOR || process.env.COMPANY_RNC || '',
        address: process.env.ECF_DIRECCION_EMISOR || process.env.COMPANY_ADDRESS || '',
        phone: process.env.ECF_TELEFONO_EMISOR || process.env.COMPANY_PHONE || '',
        email: process.env.ECF_CORREO_EMISOR || process.env.COMPANY_EMAIL || '',
        instagram: process.env.COMPANY_INSTAGRAM || '',
    };
}
