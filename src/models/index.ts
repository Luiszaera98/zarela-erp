import mongoose, { Schema, Document, Model } from 'mongoose';
import { demoTenantPlugin } from './demoPlugin';

// ==================== CLIENT ====================
export interface IClient extends Document {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    rnc?: string;
    type: 'Persona Física' | 'Persona Jurídica';
    contactType: 'Cliente' | 'Proveedor' | 'Empleado' | 'Otro';
    category: string;
    creditLimit: number;
    balance: number;
    status: 'Activo' | 'Inactivo';
    taxExemptionCode?: string; // Código Carnet Exención o Resolución (para E44)
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ClientSchema = new Schema<IClient>({
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String },
    address: { type: String },
    rnc: { type: String },
    type: { type: String, enum: ['Persona Física', 'Persona Jurídica'], required: true },
    contactType: { type: String, enum: ['Cliente', 'Proveedor', 'Empleado', 'Otro'], default: 'Cliente' },
    category: { type: String, required: true },
    creditLimit: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' },
    taxExemptionCode: { type: String },
    notes: { type: String },
}, { timestamps: true });

// Indexes for performance
ClientSchema.index({ status: 1 });
ClientSchema.index({ type: 1 });
ClientSchema.index({ contactType: 1 });
ClientSchema.plugin(demoTenantPlugin);

if (process.env.NODE_ENV === 'development' && mongoose.models.Client) {
    delete mongoose.models.Client;
}

export const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

// ==================== PRODUCT ====================
export interface IProduct extends Document {
    name: string;
    sku: string;
    category: string;
    description?: string;
    price: number;
    cost: number;
    stock: number;
    minStock: number;
    unit: string;
    status: 'Activo' | 'Inactivo';
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    cost: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    unit: { type: String, required: true },
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' },
}, { timestamps: true });

// Indexes for performance
ProductSchema.index({ status: 1 });
ProductSchema.index({ name: 'text', sku: 'text' }); // Text search support
ProductSchema.plugin(demoTenantPlugin);

// Text search support

// Force model recompilation in development
if (process.env.NODE_ENV === 'development' && mongoose.models.Product) {
    delete mongoose.models.Product;
}

export const Product: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

// ==================== SERVICE ====================
export interface IService extends Document {
    name: string;
    code?: string;
    category?: string;
    description?: string;
    price: number;
    unit: string;
    status: 'Activo' | 'Inactivo';
    createdAt: Date;
    updatedAt: Date;
}

const ServiceSchema = new Schema<IService>({
    name: { type: String, required: true },
    code: { type: String, unique: true, sparse: true },
    category: { type: String },
    description: { type: String },
    price: { type: Number, required: true },
    unit: { type: String, default: 'Por servicio' },
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' },
}, { timestamps: true });

ServiceSchema.index({ status: 1 });
ServiceSchema.index({ name: 'text', code: 'text', category: 'text' });
ServiceSchema.plugin(demoTenantPlugin);

if (process.env.NODE_ENV === 'development' && mongoose.models.Service) {
    delete mongoose.models.Service;
}

export const Service: Model<IService> = mongoose.models.Service || mongoose.model<IService>('Service', ServiceSchema);

// ==================== INVOICE ====================
export interface IInvoiceItem {
    id: string;
    productId: string;
    productName: string;
    description?: string;
    itemType?: 'product' | 'service';
    quantity: number;
    price: number;
    discount: number;
    subtotal: number;
    total: number;
    // === DGII e-CF Fields ===
    indicadorFacturacion?: number; // 1=Gravado ITBIS 18%, 2=Exento, 3=Gravado ITBIS 16%
    itbisRate?: number;            // Tasa ITBIS aplicada (0.18, 0.16, 0)
    itbisAmount?: number;          // Monto ITBIS calculado para este ítem
}

export interface IInvoice extends Document {
    number: string;
    ncf?: string;
    ncfType?: string;
    clientId: string;
    clientName: string;
    clientRnc?: string;
    clientAddress?: string;
    soldBy?: string;
    sellerEmail?: string;
    paymentTerms?: string;
    date: Date;
    dueDate: Date;
    status: 'Pagada' | 'Pendiente' | 'Vencida' | 'Anulada' | 'Parcial' | 'Nota de Crédito Parcial';
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paidAmount: number;
    items: IInvoiceItem[];
    payments?: string[];
    creditNotes?: string[];
    debitNotes?: string[];
    notes?: string;
    // === e-CF Fields ===
    encf?: string;        // e-NCF: ej "E310000000001"
    ecfStatus?: 'Pendiente' | 'Aceptado' | 'AceptadoCondicional' | 'Rechazado' | 'Contingencia';
    ecfTrackId?: string;  // UUID de seguimiento DGII
    ecfSignedXml?: string;    // XML firmado (para auditoría y reenvío al receptor)
    ecfFechaFirma?: string;   // Fecha/hora de firma digital (dd-MM-yyyy HH:mm:ss)
    ecfCodigoSeguridad?: string; // 6 primeros dígitos del hash del SignatureValue
    taxExemptionCode?: string; // Código de exención para E44/E45
    createdAt: Date;
    updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
    id: { type: String, required: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    description: { type: String },
    itemType: { type: String, enum: ['product', 'service'], default: 'product' },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    // DGII e-CF fields
    indicadorFacturacion: { type: Number, enum: [1, 2, 3], default: 1 }, // 1=Gravado 18%, 2=Exento, 3=Gravado 16%
    itbisRate: { type: Number },         // 0.18, 0.16, or 0
    itbisAmount: { type: Number },       // ITBIS amount for this item
}, { _id: false });

const InvoiceSchema = new Schema<IInvoice>({
    number: { type: String, required: true, unique: true },
    ncf: { type: String, unique: true, sparse: true },
    ncfType: { type: String },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true },
    clientRnc: { type: String },
    clientAddress: { type: String },
    soldBy: { type: String },
    sellerEmail: { type: String },
    paymentTerms: { type: String }, // 'Contado', '15 Días', etc.
    date: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['Pagada', 'Pendiente', 'Vencida', 'Anulada', 'Parcial', 'Nota de Crédito Parcial'], default: 'Pendiente' },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    items: [InvoiceItemSchema],
    payments: [{ type: String }],
    creditNotes: [{ type: String }],
    debitNotes: [{ type: String }],
    notes: { type: String },
    // === e-CF Fields ===
    encf: { type: String, unique: true, sparse: true },
    ecfStatus: {
        type: String,
        enum: ['Pendiente', 'Aceptado', 'AceptadoCondicional', 'Rechazado', 'Contingencia'],
    },
    ecfTrackId: { type: String },
    ecfSignedXml: { type: String },
    ecfFechaFirma: { type: String },
    ecfCodigoSeguridad: { type: String },
    taxExemptionCode: { type: String },
}, { timestamps: true });

// Indexes for performance
InvoiceSchema.index({ date: -1 });
InvoiceSchema.index({ clientId: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ createdAt: -1 });
InvoiceSchema.plugin(demoTenantPlugin);

// Force model recompilation in development to apply schema changes
if (process.env.NODE_ENV === 'development' && mongoose.models.Invoice) {
    delete mongoose.models.Invoice;
}

export const Invoice: Model<IInvoice> = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);

// ==================== QUOTATION ====================
export interface IQuotation extends Document {
    number: string;
    clientId: string;
    clientName: string;
    clientRnc?: string;
    clientAddress?: string;
    date: Date;
    validUntil: Date;
    status: 'Pendiente' | 'Enviada' | 'Rechazada' | 'Facturada';
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: IInvoiceItem[];
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const QuotationSchema = new Schema<IQuotation>({
    number: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true },
    clientRnc: { type: String },
    clientAddress: { type: String },
    date: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    status: { type: String, enum: ['Pendiente', 'Enviada', 'Rechazada', 'Facturada'], default: 'Pendiente' },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    items: [InvoiceItemSchema],
    notes: { type: String },
}, { timestamps: true });

QuotationSchema.index({ date: -1 });
QuotationSchema.index({ clientId: 1 });
QuotationSchema.index({ status: 1 });
QuotationSchema.plugin(demoTenantPlugin);

if (process.env.NODE_ENV === 'development' && mongoose.models.Quotation) {
    delete mongoose.models.Quotation;
}

export const Quotation: Model<IQuotation> = mongoose.models.Quotation || mongoose.model<IQuotation>('Quotation', QuotationSchema);

// ==================== PAYMENT ====================
export interface IPayment extends Document {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: 'Efectivo' | 'Transferencia' | 'Cheque' | 'Tarjeta';
    paymentDate: Date;
    reference?: string;
    notes?: string;
    createdBy: string;
    createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
    invoiceId: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta'], required: true },
    paymentDate: { type: Date, required: true },
    reference: { type: String },
    notes: { type: String },
    createdBy: { type: String, required: true },
}, { timestamps: true });

// Indexes for performance
PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ invoiceId: 1 });
PaymentSchema.index({ invoiceNumber: 1 });
PaymentSchema.plugin(demoTenantPlugin);


export const Payment: Model<IPayment> = mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);

// ==================== CREDIT NOTE ====================
export interface ICreditNote extends Document {
    number: string;
    ncf: string;
    ncfType: 'B04' | 'E34';
    originalInvoiceId: string;
    originalInvoiceNumber: string;
    originalInvoiceNcf: string;
    clientId: string;
    clientName: string;
    clientRnc?: string;
    date: Date;
    reason: string;
    codigoModificacion?: number; // 1=Anula, 2=Corrige texto, 3=Corrige montos, 4=Reemplazo contingencia
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: IInvoiceItem[];
    notes?: string;
    // === e-CF Fields (para E34) ===
    encf?: string;
    ecfStatus?: 'Pendiente' | 'Aceptado' | 'AceptadoCondicional' | 'Rechazado' | 'Contingencia';
    ecfTrackId?: string;
    ecfSignedXml?: string;
    ecfFechaFirma?: string;
    ecfCodigoSeguridad?: string;
    createdAt: Date;
    updatedAt: Date;
}

const CreditNoteSchema = new Schema<ICreditNote>({
    number: { type: String, required: true, unique: true },
    ncf: { type: String, required: true, unique: true },
    ncfType: { type: String, enum: ['B04', 'E34'], default: 'B04' },
    originalInvoiceId: { type: String, required: true },
    originalInvoiceNumber: { type: String, required: true },
    originalInvoiceNcf: { type: String, required: true },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true },
    clientRnc: { type: String },
    date: { type: Date, required: true },
    reason: { type: String, required: true },
    codigoModificacion: { type: Number, enum: [1, 2, 3, 4] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    items: [InvoiceItemSchema],
    notes: { type: String },
    // === e-CF Fields ===
    encf: { type: String, unique: true, sparse: true },
    ecfStatus: {
        type: String,
        enum: ['Pendiente', 'Aceptado', 'AceptadoCondicional', 'Rechazado', 'Contingencia'],
    },
    ecfTrackId: { type: String },
    ecfSignedXml: { type: String },
    ecfFechaFirma: { type: String },
    ecfCodigoSeguridad: { type: String },
}, { timestamps: true });

// Indexes for performance
CreditNoteSchema.index({ originalInvoiceId: 1 });
CreditNoteSchema.index({ date: -1 });
CreditNoteSchema.plugin(demoTenantPlugin);

// Force model recompilation in development to apply schema changes
if (process.env.NODE_ENV === 'development' && mongoose.models.CreditNote) {
    delete mongoose.models.CreditNote;
}

export const CreditNote: Model<ICreditNote> = mongoose.models.CreditNote || mongoose.model<ICreditNote>('CreditNote', CreditNoteSchema);

// ==================== DEBIT NOTE ====================
export interface IDebitNote extends Document {
    number: string;
    ncf: string;
    ncfType: 'B03' | 'E33';
    originalInvoiceId: string;
    originalInvoiceNumber: string;
    originalInvoiceNcf: string;
    clientId: string;
    clientName: string;
    clientRnc?: string;
    date: Date;
    reason: string;
    codigoModificacion?: number; // 1=Corrige montos, 2=Corrige texto, etc.
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: IInvoiceItem[];
    notes?: string;
    // === e-CF Fields (para E33) ===
    encf?: string;
    ecfStatus?: 'Pendiente' | 'Aceptado' | 'AceptadoCondicional' | 'Rechazado' | 'Contingencia';
    ecfTrackId?: string;
    ecfSignedXml?: string;
    ecfFechaFirma?: string;
    ecfCodigoSeguridad?: string;
    createdAt: Date;
    updatedAt: Date;
}

const DebitNoteSchema = new Schema<IDebitNote>({
    number: { type: String, required: true, unique: true },
    ncf: { type: String, required: true, unique: true },
    ncfType: { type: String, enum: ['B03', 'E33'], default: 'B03' },
    originalInvoiceId: { type: String, required: true },
    originalInvoiceNumber: { type: String, required: true },
    originalInvoiceNcf: { type: String, required: true },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true },
    clientRnc: { type: String },
    date: { type: Date, required: true },
    reason: { type: String, required: true },
    codigoModificacion: { type: Number, enum: [1, 2, 3, 4] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    items: [InvoiceItemSchema],
    notes: { type: String },
    // === e-CF Fields ===
    encf: { type: String, unique: true, sparse: true },
    ecfStatus: {
        type: String,
        enum: ['Pendiente', 'Aceptado', 'AceptadoCondicional', 'Rechazado', 'Contingencia'],
    },
    ecfTrackId: { type: String },
    ecfSignedXml: { type: String },
    ecfFechaFirma: { type: String },
    ecfCodigoSeguridad: { type: String },
}, { timestamps: true });

// Indexes for performance
DebitNoteSchema.index({ originalInvoiceId: 1 });
DebitNoteSchema.index({ date: -1 });
DebitNoteSchema.plugin(demoTenantPlugin);

// Force model recompilation in development to apply schema changes
if (process.env.NODE_ENV === 'development' && mongoose.models.DebitNote) {
    delete mongoose.models.DebitNote;
}

export const DebitNote: Model<IDebitNote> = mongoose.models.DebitNote || mongoose.model<IDebitNote>('DebitNote', DebitNoteSchema);


// ==================== EXPENSE ====================
export interface IExpense extends Document {
    description: string;
    category: string;
    amount: number;
    date: Date;
    supplier?: string;
    supplierRnc?: string;
    invoiceNumber?: string;
    paymentMethod: string;
    reference?: string;
    status: 'Pagada' | 'Pendiente' | 'Parcial';
    paidAmount: number;
    lastPaymentDate?: Date;
    notes?: string;
    attachments?: string[];
    createdAt: Date;
    updatedAt: Date;
    // === e-CF Fields for E41, E43, E47 ===
    ncf?: string;
    ncfType?: string; // 'E41', 'E43', 'E47', etc.
    encf?: string;
    ecfStatus?: 'Pendiente' | 'Aceptado' | 'AceptadoCondicional' | 'Rechazado' | 'Contingencia';
    ecfTrackId?: string;
    ecfSignedXml?: string;
    ecfFechaFirma?: string;
    ecfCodigoSeguridad?: string;
}

const ExpenseSchema = new Schema<IExpense>({
    description: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    supplier: { type: String },
    supplierRnc: { type: String },
    invoiceNumber: { type: String },
    paymentMethod: { type: String, required: true },
    reference: { type: String },
    status: { type: String, enum: ['Pagada', 'Pendiente', 'Parcial'], default: 'Pendiente' },
    paidAmount: { type: Number, default: 0 },
    lastPaymentDate: { type: Date },
    notes: { type: String },
    attachments: [{ type: String }],
    // === e-CF Fields ===
    ncf: { type: String },
    ncfType: { type: String },
    encf: { type: String },
    ecfStatus: { type: String, enum: ['Pendiente', 'Aceptado', 'AceptadoCondicional', 'Rechazado', 'Contingencia'] },
    ecfTrackId: { type: String },
    ecfSignedXml: { type: String },
    ecfFechaFirma: { type: String },
    ecfCodigoSeguridad: { type: String },
}, { timestamps: true });

// Indexes for performance
ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ category: 1 });
ExpenseSchema.plugin(demoTenantPlugin);

if (process.env.NODE_ENV === 'development' && mongoose.models.Expense) {
    delete mongoose.models.Expense;
}

export const Expense: Model<IExpense> = mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);

// ==================== EXPENSE TRANSACTION ====================
export interface IExpenseTransaction extends Document {
    expenseId: string;
    amount: number;
    paymentMethod: string;
    date: Date;
    notes?: string;
    attachments?: string[];
    createdAt: Date;
}

const ExpenseTransactionSchema = new Schema<IExpenseTransaction>({
    expenseId: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    date: { type: Date, required: true },
    notes: { type: String },
    attachments: [{ type: String }],
}, { timestamps: true });

ExpenseTransactionSchema.index({ expenseId: 1 });
ExpenseTransactionSchema.index({ date: -1 });
ExpenseTransactionSchema.plugin(demoTenantPlugin);

export const ExpenseTransaction: Model<IExpenseTransaction> = mongoose.models.ExpenseTransaction || mongoose.model<IExpenseTransaction>('ExpenseTransaction', ExpenseTransactionSchema);

// ==================== RECURRING EXPENSE ====================
export interface IRecurringExpense extends Document {
    description: string;
    category: string;
    amount: number;
    supplier?: string;
    frequency: 'Semanal' | 'Quincenal' | 'Mensual' | 'Anual';
    dayOfMonth?: number;
    nextRun: Date;
    active: boolean;
    lastGenerated?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const RecurringExpenseSchema = new Schema<IRecurringExpense>({
    description: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    supplier: { type: String },
    frequency: { type: String, enum: ['Semanal', 'Quincenal', 'Mensual', 'Anual'], required: true },
    dayOfMonth: { type: Number },
    nextRun: { type: Date, required: true },
    active: { type: Boolean, default: true },
    lastGenerated: { type: Date },
}, { timestamps: true });

RecurringExpenseSchema.plugin(demoTenantPlugin);

export const RecurringExpense: Model<IRecurringExpense> = mongoose.models.RecurringExpense || mongoose.model<IRecurringExpense>('RecurringExpense', RecurringExpenseSchema);

// ==================== USER ====================
export interface IUser extends Document {
    name: string;
    username: string;
    email?: string;
    password?: string; // In a real app, this should be hashed
    role: 'Admin' | 'Comercial' | 'Operaciones' | 'Vendedor' | 'Almacén' | 'Gerente';
    status: 'Activo' | 'Inactivo';
    mustChangePassword?: boolean;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    role: { type: String, enum: ['Admin', 'Comercial', 'Operaciones', 'Vendedor', 'Almacén', 'Gerente'], default: 'Comercial' },
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' },
    mustChangePassword: { type: Boolean, default: false },
}, { timestamps: true });

UserSchema.index({ username: 1 });

if (process.env.NODE_ENV === 'development' && mongoose.models.User) {
    delete mongoose.models.User;
}

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

// ==================== SEQUENCE (NCF) ====================
export interface ISequence extends Document {
    type: string; // B01, B02, B04, etc.
    currentValue: number;
    updatedAt: Date;
}

const SequenceSchema = new Schema<ISequence>({
    type: { type: String, required: true, unique: true },
    currentValue: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export const Sequence: Model<ISequence> = mongoose.models.Sequence || mongoose.model<ISequence>('Sequence', SequenceSchema);

// ==================== CONFIGURATION ====================
export interface IConfiguration extends Document {
    key: string; // e.g., 'chorizo_types'
    value: any; // Array of strings, object, etc.
}

const ConfigurationSchema = new Schema<IConfiguration>({
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });

export const Configuration: Model<IConfiguration> = mongoose.models.Configuration || mongoose.model<IConfiguration>('Configuration', ConfigurationSchema);

// ==================== INVENTORY MOVEMENT ====================
export interface IInventoryMovement extends Document {
    productId: string;
    productName: string;
    type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
    quantity: number;
    reference?: string;
    notes?: string;
    date: Date;
    createdAt: Date;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>({
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    type: { type: String, enum: ['ENTRADA', 'SALIDA', 'AJUSTE'], required: true },
    quantity: { type: Number, required: true },
    reference: { type: String },
    notes: { type: String },
    date: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

// Indexes for performance
InventoryMovementSchema.index({ productId: 1 });
InventoryMovementSchema.index({ date: -1 });
InventoryMovementSchema.index({ type: 1 });
InventoryMovementSchema.plugin(demoTenantPlugin);

export const InventoryMovement: Model<IInventoryMovement> = mongoose.models.InventoryMovement || mongoose.model<IInventoryMovement>('InventoryMovement', InventoryMovementSchema);

// ==================== E-CF AUDIT LOG ====================
export interface IEcfAuditLog extends Document {
    documentId?: string; // Reference to Invoice or Expense ID
    documentType?: 'Invoice' | 'CreditNote' | 'DebitNote' | 'Expense' | 'Other';
    action: string;      // e.g. 'SEND_ECF', 'RECEIVE_ARECF', 'CHECK_STATUS', 'QUERY_DIRECTORY'
    status: 'SUCCESS' | 'ERROR';
    trackId?: string;
    encf?: string;
    message?: string;
    requestPayload?: string;  // Stores JSON or short XML snippet
    responsePayload?: string; // Stores JSON or short XML snippet
    createdAt: Date;
    updatedAt: Date;
}

const EcfAuditLogSchema = new Schema<IEcfAuditLog>({
    documentId: { type: String },
    documentType: { type: String, enum: ['Invoice', 'CreditNote', 'DebitNote', 'Expense', 'Other'] },
    action: { type: String, required: true },
    status: { type: String, enum: ['SUCCESS', 'ERROR'], required: true },
    trackId: { type: String },
    encf: { type: String },
    message: { type: String },
    requestPayload: { type: String },
    responsePayload: { type: String }
}, { timestamps: true });

EcfAuditLogSchema.index({ documentId: 1 });
EcfAuditLogSchema.index({ trackId: 1 });
EcfAuditLogSchema.index({ encf: 1 });
EcfAuditLogSchema.index({ createdAt: -1 });

if (process.env.NODE_ENV === 'development' && mongoose.models.EcfAuditLog) {
    delete mongoose.models.EcfAuditLog;
}

export const EcfAuditLog: Model<IEcfAuditLog> = mongoose.models.EcfAuditLog || mongoose.model<IEcfAuditLog>('EcfAuditLog', EcfAuditLogSchema);
