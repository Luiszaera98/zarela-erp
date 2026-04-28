"use client";

import React, { useEffect, useState } from 'react';
import { getCompanyInfo } from '@/lib/actions/companyActions';
import { getQuotationById } from '@/lib/actions/quotationActions';

export default function QuotationPrintPage({ params }: { params: { id: string } }) {
    const [quotation, setQuotation] = useState<any | null>(null);
    const [companyInfo, setCompanyInfo] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [quotationData, companyData] = await Promise.all([
                    getQuotationById(params.id),
                    getCompanyInfo(),
                ]);

                setQuotation(quotationData);
                setCompanyInfo(companyData);
            } catch (error) {
                console.error("Error fetching quotation data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [params.id]);

    useEffect(() => {
        const generatePDF = async () => {
            if (quotation && companyInfo && !loading) {
                const { generateQuotationPDF } = await import('@/lib/pdf/invoiceGenerator');
                const doc = await generateQuotationPDF(quotation, companyInfo);
                const pdfBlob = doc.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                setPdfUrl(url);
            }
        };

        generatePDF();
    }, [quotation, companyInfo, loading]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-500 font-medium">Generando cotización...</p>
            </div>
        );
    }

    if (!quotation) {
        return <div className="flex items-center justify-center h-screen text-red-500">Cotización no encontrada</div>;
    }

    return (
        <div className="h-screen w-screen bg-gray-800 flex flex-col">
            <div className="bg-black text-white p-2 flex justify-between items-center px-6">
                <h1 className="text-sm font-bold">Vista Previa de Cotización - {quotation.number}</h1>
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
                        title="Quotation PDF"
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
