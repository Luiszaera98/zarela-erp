"use server";

/**
 * ecfContingencyActions.ts
 * Manejo de contingencia e-CF según Sección 18 del Informe Técnico e-CF v1.0 DGII.
 *
 * Contingencia Total: Cuando NO se puede emitir ningún e-CF.
 * Contingencia Parcial: Cuando alguna sucursal/punto no puede emitir.
 *
 * Flujo:
 *   1. Activar contingencia → sistema emite facturas con NCF serie B (tradicional)
 *   2. Cuando se reestablece → las facturas B se reemplazan con e-NCF serie E
 *      usando CodigoModificacion = 4 (Reemplazo NCF emitido en contingencia)
 *   3. Se marcan las facturas originales (B) como reemplazadas
 */

import dbConnect from '@/lib/db';
import { Configuration, Invoice as InvoiceModel } from '@/models';
import { revalidatePath } from 'next/cache';
import { sendECF } from './ecfActions';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContingencyType = 'total' | 'parcial';

export interface ContingencyStatus {
  active: boolean;
  type?: ContingencyType;
  activatedAt?: string;    // ISO date
  reason?: string;
  invoiceCount: number;    // Number of invoices issued during contingency
}

// ─── NOTA: Estado de contingencia se almacena en memoria del proceso.
//     En producción con múltiples instancias, deberías usar la DB.
const CONTINGENCY_CONFIG_KEY = 'ecf_contingency_state_v1';

let _contingencyState: {
  active: boolean;
  type?: ContingencyType;
  activatedAt?: Date;
  reason?: string;
} = { active: false };

async function loadContingencyState() {
  await dbConnect();

  const config = await Configuration.findOne({ key: CONTINGENCY_CONFIG_KEY }).lean();
  if (!config?.value) {
    return _contingencyState;
  }

  const value = config.value as {
    active?: boolean;
    type?: ContingencyType;
    activatedAt?: string;
    reason?: string;
  };

  _contingencyState = {
    active: !!value.active,
    type: value.type,
    activatedAt: value.activatedAt ? new Date(value.activatedAt) : undefined,
    reason: value.reason,
  };

  return _contingencyState;
}

async function saveContingencyState() {
  await dbConnect();

  await Configuration.findOneAndUpdate(
    { key: CONTINGENCY_CONFIG_KEY },
    {
      key: CONTINGENCY_CONFIG_KEY,
      value: {
        active: _contingencyState.active,
        type: _contingencyState.type,
        activatedAt: _contingencyState.activatedAt?.toISOString(),
        reason: _contingencyState.reason,
      },
    },
    { upsert: true, new: true }
  );
}

// ─── Activar modo contingencia ────────────────────────────────────────────────

export async function activateContingency(
  type: ContingencyType = 'total',
  reason?: string
): Promise<{ success: boolean; message: string }> {
  _contingencyState = {
    active: true,
    type,
    activatedAt: new Date(),
    reason: reason || 'Falla en el sistema e-CF.',
  };

  await saveContingencyState();

  console.log(`[CONTINGENCIA] ACTIVADA (${type}): ${reason}`);

  return {
    success: true,
    message: `Modo contingencia ${type} activado. Las nuevas facturas se emitirán con NCF serie B hasta que se desactive.`,
  };
}

// ─── Desactivar modo contingencia ─────────────────────────────────────────────

export async function deactivateContingency(): Promise<{
  success: boolean;
  message: string;
  pendingReplacements: number;
}> {
  const currentState = await loadContingencyState();

  if (!currentState.active) {
    return {
      success: false,
      message: 'No hay contingencia activa.',
      pendingReplacements: 0,
    };
  }

  await dbConnect();

  // Count invoices issued during contingency that need replacement
  const pendingInvoices = await InvoiceModel.countDocuments({
    ecfStatus: 'Contingencia',
  });

  _contingencyState = { active: false };
  await saveContingencyState();

  console.log(`[CONTINGENCIA] DESACTIVADA. ${pendingInvoices} facturas pendientes de reemplazo.`);

  revalidatePath('/invoices');

  return {
    success: true,
    message: `Contingencia desactivada. ${pendingInvoices} factura(s) emitidas en contingencia necesitan reemplazo a e-NCF.`,
    pendingReplacements: pendingInvoices,
  };
}

// ─── Consultar estado de contingencia ─────────────────────────────────────────

export async function getContingencyStatus(): Promise<ContingencyStatus> {
  const state = await loadContingencyState();

  const invoiceCount = await InvoiceModel.countDocuments({
    ecfStatus: 'Contingencia',
  });

  return {
    active: state.active,
    type: state.type,
    activatedAt: state.activatedAt?.toISOString(),
    reason: state.reason,
    invoiceCount,
  };
}

// ─── Verificar si estamos en contingencia ─────────────────────────────────────

export async function isContingencyActive(): Promise<boolean> {
  const state = await loadContingencyState();
  return state.active;
}

// ─── Obtener facturas de contingencia pendientes de reemplazo ─────────────────

export async function getContingencyInvoices(): Promise<{
  id: string;
  number: string;
  ncf: string;
  ncfType: string;
  clientName: string;
  total: number;
  date: string;
}[]> {
  await dbConnect();

  const invoices = await InvoiceModel.find({
    ecfStatus: 'Contingencia',
  })
    .select('number ncf ncfType clientName total date')
    .sort({ date: -1 })
    .lean();

  return invoices.map((doc: any) => ({
    id: doc._id.toString(),
    number: doc.number,
    ncf: doc.ncf || '',
    ncfType: doc.ncfType || '',
    clientName: doc.clientName,
    total: doc.total,
    date: doc.date instanceof Date ? doc.date.toISOString() : doc.date,
  }));
}

// ─── Reemplazar una factura de contingencia con e-NCF ─────────────────────────

/**
 * Toma una factura emitida en contingencia (serie B) y la envía como e-CF
 * con CodigoModificacion = 4 (Reemplazo NCF emitido en contingencia).
 *
 * El NCF B original se mantiene como referencia en eNCFModificado.
 */
export async function replaceContingencyInvoice(
  invoiceId: string,
  newNcfType: 'E31' | 'E32'
): Promise<{
  success: boolean;
  message?: string;
  encf?: string;
}> {
  await dbConnect();

  const doc = await InvoiceModel.findById(invoiceId).lean() as any;
  if (!doc) {
    return { success: false, message: 'Factura no encontrada.' };
  }

  if (doc.ecfStatus !== 'Contingencia') {
    return {
      success: false,
      message: 'Esta factura no está marcada como contingencia.',
    };
  }

  const originalNcf = doc.ncf;
  if (!originalNcf) {
    return {
      success: false,
      message: 'La factura no tiene NCF original de contingencia.',
    };
  }

  // 1. Update ncfType to the electronic equivalent
  await InvoiceModel.findByIdAndUpdate(invoiceId, {
    ncfType: newNcfType,
    ecfStatus: 'Pendiente', // Reset status to allow sending
    encf: undefined, // Clear any previous e-NCF
    ecfTrackId: undefined,
  });

  // 2. Send as e-CF with contingency replacement flag
  const result = await sendECF(invoiceId, {
    encfAfectado: originalNcf,
    codigoModificacion: 4, // Reemplazo NCF emitido en contingencia
  });

  if (!result.success) {
    // Revert ncfType if sending failed
    await InvoiceModel.findByIdAndUpdate(invoiceId, {
      ncfType: doc.ncfType,
      ecfStatus: 'Contingencia',
    });
    return { success: false, message: result.message };
  }

  revalidatePath('/invoices');

  return {
    success: true,
    encf: result.encf,
    message: `Factura ${doc.number} reemplazada. NCF original (${originalNcf}) → e-NCF (${result.encf})`,
  };
}

// ─── Reemplazar todas las facturas de contingencia ────────────────────────────

export async function replaceAllContingencyInvoices(): Promise<{
  success: boolean;
  message: string;
  replaced: number;
  failed: number;
  errors: string[];
}> {
  await dbConnect();

  const invoices = await InvoiceModel.find({
    ecfStatus: 'Contingencia',
  }).lean();

  let replaced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const doc of invoices as any[]) {
    // Determine the electronic equivalent
    const ncfType = doc.ncfType || '';
    let newNcfType: 'E31' | 'E32';

    // B01 (Crédito Fiscal) → E31
    // B02 (Consumidor Final) → E32
    if (ncfType === 'B01') {
      newNcfType = 'E31';
    } else {
      newNcfType = 'E32'; // Default to consumo
    }

    const result = await replaceContingencyInvoice(doc._id.toString(), newNcfType);
    if (result.success) {
      replaced++;
    } else {
      failed++;
      errors.push(`${doc.number}: ${result.message}`);
    }
  }

  revalidatePath('/invoices');

  return {
    success: failed === 0,
    message: `Reemplazadas ${replaced} de ${replaced + failed} facturas.`,
    replaced,
    failed,
    errors,
  };
}
