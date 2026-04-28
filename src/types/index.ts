export type ContactType = 'Cliente' | 'Proveedor' | 'Empleado' | 'Otro';

export const CONTACT_TYPES: ContactType[] = ['Cliente', 'Proveedor', 'Empleado', 'Otro'];

export type UserRole = 'Administrador' | 'Comercial' | 'Operaciones';

export interface Client {
    id: string;
    name: string;
    contactType: ContactType;
    rncCedula?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
    taxExemptionCode?: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export type ProductType = string;

export const DEFAULT_PRODUCT_TYPES = ['Chorizo', 'Materia Prima', 'Maquinaria y Equipos'];

export type ProductTypeCatalog = Record<string, string[]>;

export interface Product {
    id: string;
    name: string;
    description?: string;
    type: ProductType;
    sku: string;
    price: number;
    cost: number;
    stock: number;
    minStock: number;
    category?: string;
    unit: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface Service {
    id: string;
    name: string;
    code?: string;
    category?: string;
    description?: string;
    price: number;
    unit: string;
    status: 'Activo' | 'Inactivo';
    createdAt: Date | string;
    updatedAt: Date | string;
}

export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface InventoryMovement {
    id: string;
    productId: string;
    productName: string;
    type: MovementType;
    quantity: number;
    reference?: string; // e.g. Invoice Number or 'Manual'
    notes?: string;
    date: Date | string;
    createdAt: Date | string;
}

export type InvoiceStatus = 'Pagada' | 'Pendiente' | 'Vencida' | 'Anulada' | 'Parcial' | 'Nota de Crédito Parcial';

// NCF Types for Dominican Republic (DGII) — Tradicionales
export type NCFType = 'B01' | 'B02' | 'B04' | 'B14' | 'B15' | 'B16' | 'S/C'
    // e-NCF (Comprobantes Fiscales Electrónicos)
    | 'E31' | 'E32' | 'E33' | 'E34' | 'E41' | 'E43' | 'E44' | 'E45' | 'E46' | 'E47';

export const NCF_TYPES: Record<string, string> = {
    // Tradicionales
    'B01': 'Crédito Fiscal',
    'B02': 'Consumidor Final',
    'B04': 'Nota de Crédito',
    'B14': 'Regímenes Especiales',
    'B15': 'Gubernamental',
    'B16': 'Exportaciones',
    'S/C': 'Sin Comprobante Fiscal',
    // Electrónicos (e-NCF) — Según Informe Técnico e-CF v1.0 DGII
    'E31': 'Factura de Crédito Fiscal Electrónica',
    'E32': 'Factura de Consumo Electrónica',
    'E33': 'Nota de Débito Electrónica',
    'E34': 'Nota de Crédito Electrónica',
    'E41': 'Comprobante Electrónico de Compras',
    'E43': 'Comprobante Electrónico para Gastos Menores',
    'E44': 'Comprobante Electrónico para Regímenes Especiales',
    'E45': 'Comprobante Electrónico Gubernamental',
    'E46': 'Comprobante Electrónico para Exportaciones',
    'E47': 'Comprobante Electrónico para Pagos al Exterior',
};

// e-CF ECF Status (from DGII)
export type ECFStatus = 'Pendiente' | 'Aceptado' | 'AceptadoCondicional' | 'Rechazado' | 'Contingencia';

export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Cheque' | 'Tarjeta';

export interface Payment {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: Date | string;
    reference?: string; // Reference number for transfer or check
    notes?: string;
    createdBy: string;
    createdAt: Date | string;
}

export interface CreditNote {
    id: string;
    number: string;
    ncf: string; // B04 NCF o E34 e-NCF
    ncfType: 'B04' | 'E34';
    originalInvoiceId: string;
    originalInvoiceNumber: string;
    originalInvoiceNcf: string;
    clientId: string;
    clientName: string;
    clientRnc?: string;
    date: Date | string;
    reason: string;
    /**
     * Código de modificación según DGII (solo para E34):
     * 1 = Anula el NCF modificado
     * 2 = Corrige texto del comprobante fiscal modificado
     * 3 = Corrige montos del NCF modificado
     * 4 = Reemplazo NCF emitido en contingencia
     */
    codigoModificacion?: 1 | 2 | 3 | 4;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: InvoiceItem[];
    notes?: string;
    // === e-CF Fields (para E34) ===
    encf?: string;
    ecfStatus?: ECFStatus;
    ecfTrackId?: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface Invoice {
    id: string;
    number: string;
    ncf?: string; // Número de Comprobante Fiscal (DGII)
    ncfType?: NCFType;
    clientId: string;
    clientName: string;
    clientRnc?: string; // RNC/Cédula del cliente
    clientAddress?: string;
    soldBy?: string;
    sellerEmail?: string;
    paymentTerms?: string;
    date: Date | string;
    dueDate: Date | string;
    status: InvoiceStatus;
    subtotal: number;
    discount: number; // Descuento total
    tax: number; // ITBIS (18%)
    total: number;
    paidAmount: number; // Total paid towards this invoice
    items: InvoiceItem[];
    payments?: string[]; // Payment IDs
    creditNotes?: string[]; // Credit Note IDs that affect this invoice
    notes?: string;
    // === e-CF Fields ===
    encf?: string;       // e-NCF electrónico ej: "E310000000001"
    ecfStatus?: ECFStatus;
    ecfTrackId?: string; // UUID de seguimiento DGII
    ecfSignedXml?: string;    // XML firmado para auditoría
    ecfFechaFirma?: string;   // Fecha/hora de firma digital
    ecfCodigoSeguridad?: string; // 6 primeros dígitos del hash del SignatureValue
    taxExemptionCode?: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface InvoiceItem {
    id: string;
    productId: string;
    productName: string;
    description?: string;
    itemType?: 'product' | 'service';
    quantity: number;
    price: number;
    discount: number; // Descuento por ítem (porcentaje)
    subtotal: number; // Precio * Cantidad
    total: number; // Subtotal - Descuento
    // === DGII e-CF Fields ===
    /** 1=Gravado ITBIS 18%, 2=Exento, 3=Gravado ITBIS 16% */
    indicadorFacturacion?: number;
    /** Tasa ITBIS aplicada: 0.18 | 0.16 | 0 */
    itbisRate?: number;
    /** Monto ITBIS calculado para este ítem */
    itbisAmount?: number;
}

export type QuotationStatus = 'Pendiente' | 'Enviada' | 'Rechazada' | 'Facturada';

export interface Quotation {
    id: string;
    number: string;
    clientId: string;
    clientName: string;
    clientRnc?: string;
    clientAddress?: string;
    date: Date | string;
    validUntil: Date | string;
    status: QuotationStatus;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: InvoiceItem[];
    notes?: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export type ExpenseCategory = string;

export const DEFAULT_EXPENSE_CATEGORIES = ['Servicios', 'Nómina', 'Materia Prima', 'Mantenimiento', 'Impuestos', 'Préstamos', 'Otros'];

export interface Expense {
    id: string;
    description: string;
    amount: number;
    date: Date | string;
    category: ExpenseCategory;
    supplierId?: string;
    supplierName?: string;
    supplierRnc?: string;
    invoiceNumber?: string;
    paymentMethod?: string;
    reference?: string;
    status: 'Pagada' | 'Pendiente' | 'Parcial';
    paidAmount?: number;
    lastPaymentDate?: string;
    notes?: string;
    attachments?: string[];
    createdAt: Date | string;
    updatedAt: Date | string;
    // === e-CF Fields ===
    ncf?: string;
    ncfType?: string; // 'E41', 'E43', 'E47', etc.
    encf?: string;
    ecfStatus?: ECFStatus;
    ecfTrackId?: string;
    ecfSignedXml?: string;
    ecfFechaFirma?: string;
    ecfCodigoSeguridad?: string;
}

export interface RecurringExpense {
    id: string;
    description: string;
    category: ExpenseCategory;
    amount: number;
    supplier?: string;
    frequency: 'Semanal' | 'Quincenal' | 'Mensual' | 'Anual';
    dayOfMonth?: number;
    nextRun: Date | string;
    active: boolean;
    lastGenerated?: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
}
