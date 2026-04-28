"use client";

import { getCompanyInfo } from "@/lib/actions/companyActions";
import { getInvoiceById } from "@/lib/actions/invoiceActions";
import { getCreditNotesByInvoice, getDebitNotesByInvoice } from "@/lib/actions/paymentActions";
import { getQuotationById } from "@/lib/actions/quotationActions";
import { generateInvoicePDF, generateQuotationPDF } from "@/lib/pdf/invoiceGenerator";

type ShareResult = { shared: boolean; downloaded: boolean };

async function shareOrDownloadPdf(doc: any, filename: string, title: string): Promise<ShareResult> {
    const blob = doc.output("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { title?: string; files?: File[] }) => Promise<void>;
    };

    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({ title, files: [file] });
        return { shared: true, downloaded: false };
    }

    doc.save(filename);
    return { shared: false, downloaded: true };
}

export async function shareInvoicePdf(invoiceId: string): Promise<ShareResult> {
    const [invoice, companyInfo, creditNotes, debitNotes] = await Promise.all([
        getInvoiceById(invoiceId),
        getCompanyInfo(),
        getCreditNotesByInvoice(invoiceId),
        getDebitNotesByInvoice(invoiceId),
    ]);
    if (!invoice) throw new Error("Factura no encontrada");
    const isElectronic = Boolean(invoice.ncfType?.startsWith("E") || invoice.encf);
    const doc = await generateInvoicePDF({ ...invoice, creditNoteDetails: creditNotes, debitNoteDetails: debitNotes }, companyInfo, isElectronic);
    return shareOrDownloadPdf(doc, `factura-${invoice.number}.pdf`, `Factura ${invoice.number}`);
}

export async function shareQuotationPdf(quotationId: string): Promise<ShareResult> {
    const [quotation, companyInfo] = await Promise.all([getQuotationById(quotationId), getCompanyInfo()]);
    if (!quotation) throw new Error("Cotización no encontrada");
    const doc = await generateQuotationPDF(quotation, companyInfo);
    return shareOrDownloadPdf(doc, `cotizacion-${quotation.number}.pdf`, `Cotización ${quotation.number}`);
}
