"use client";

import React, { useEffect, useState, useRef } from 'react';
import { getInvoiceById } from '@/lib/actions/invoiceActions';
import { getCreditNotesByInvoice, getDebitNotesByInvoice } from '@/lib/actions/paymentActions';
import { getClientById } from '@/lib/actions/clientActions';
import { getEcfSequenceExpirationDate } from '@/lib/actions/ecfActions';
import { getCompanyInfo } from '@/lib/actions/companyActions';
import { Invoice, CreditNote, NCF_TYPES } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calcITBISTotals } from '@/lib/ecf/ecfTransformer';
import { getECFTypeName, generateVerificationUrl, isECF, formatRNC } from '@/lib/ecf/ecfPrintUtils';
import QRCode from 'qrcode';

export default function InvoicePrintPage({ params }: { params: { id: string } }) {
    const [invoice, setInvoice] = useState<any | null>(null);
    const [companyInfo, setCompanyInfo] = useState<any | null>(null);
    const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
    const [debitNotes, setDebitNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [qrUrl, setQrUrl] = useState<string>('');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [ncfExpirationDate, setNcfExpirationDate] = useState<string>('31-12-2028');

    const isElectronic = invoice ? isECF(invoice.encf || invoice.ncf) : false;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [invoiceData, notesData, debitsData, configuredExpirationDate, companyData] = await Promise.all([
                    getInvoiceById(params.id),
                    getCreditNotesByInvoice(params.id),
                    getDebitNotesByInvoice(params.id),
                    getEcfSequenceExpirationDate(),
                    getCompanyInfo(),
                ]);

                if (invoiceData && !invoiceData.clientAddress && invoiceData.clientId && invoiceData.clientId !== 'placeholder') {
                    try {
                        const client = await getClientById(invoiceData.clientId);
                        if (client && client.address) {
                            invoiceData.clientAddress = client.address;
                        }
                    } catch (e) {
                        console.error("Error fetching client address fallback:", e);
                    }
                }

                console.log("INVOICE DATA FOR PRINT:", invoiceData);
                setInvoice(invoiceData);
                setCompanyInfo(companyData);
                setCreditNotes(notesData);
                setDebitNotes(debitsData);
                setNcfExpirationDate(configuredExpirationDate);

                // Generar URL para QR
                if (invoiceData) {
                    if (isECF(invoiceData.encf || invoiceData.ncf)) {
                        const url = generateVerificationUrl(
                            companyData.rnc,
                            invoiceData.encf || invoiceData.ncf || '',
                            invoiceData.total,
                            invoiceData.date,
                            invoiceData.ecfCodigoSeguridad,
                            invoiceData.clientRnc,
                            invoiceData.ecfFechaFirma,
                            invoiceData.ecfSignedXml
                        );
                        console.log("URL GENERADA PARA QR e-CF:", url);
                        setQrUrl(url);
                    } else {
                        // URL interna para facturas normales
                        const url = `${window.location.origin}/invoices/${invoiceData.id}`;
                        console.log("URL GENERADA PARA QR NORMAL:", url);
                        setQrUrl(url);
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [params.id]);

    useEffect(() => {
        const generatePDF = async () => {
            if (invoice && companyInfo && !loading) {
                const { generateInvoicePDF } = await import('@/lib/pdf/invoiceGenerator');
                const doc = await generateInvoicePDF({ ...invoice, creditNoteDetails: creditNotes, debitNoteDetails: debitNotes }, companyInfo, isElectronic, ncfExpirationDate);
                
                // Convertir a URL para mostrar en el iframe
                const pdfBlob = doc.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                setPdfUrl(url);
            }
        };
        generatePDF();
    }, [invoice, companyInfo, creditNotes, debitNotes, loading, isElectronic, ncfExpirationDate]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-500 font-medium">Generando documento profesional...</p>
            </div>
        );
    }

    if (!invoice) {
        return <div className="flex items-center justify-center h-screen text-red-500">Documento no encontrado</div>;
    }

    return (
        <div className="h-screen w-screen bg-gray-800 flex flex-col">
            <div className="bg-black text-white p-2 flex justify-between items-center px-6">
                <h1 className="text-sm font-bold">Vista Previa de Impresión - {invoice.ncf || invoice.id}</h1>
                <button 
                    onClick={() => window.close()}
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                >
                    Cerrar
                </button>
            </div>
            <div className="flex-1 w-full h-full overflow-hidden">
                {pdfUrl ? (
                    <iframe 
                        src={pdfUrl} 
                        className="w-full h-full border-none"
                        title="Invoice PDF"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-white">
                        Preparando vista previa...
                    </div>
                )}
            </div>
        </div>
    );
}
