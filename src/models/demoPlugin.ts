import mongoose from 'mongoose';
import { getSession } from '@/lib/auth/session';

/**
 * Mongoose Plugin para implementar "Modo Demo" Multi-Tenant.
 * Este plugin inyecta un campo `_demoCreatedBy` en los modelos y filtra automáticamente
 * las consultas si `IS_DEMO_MODE=true` y el usuario no es Administrador.
 */
export function demoTenantPlugin(schema: mongoose.Schema) {
    // 1. Añadir el campo de forma dinámica al schema
    schema.add({ _demoCreatedBy: { type: String, index: true } });

    // 2. Interceptar creación de documentos individuales
    schema.pre('save', async function(next) {
        if (process.env.IS_DEMO_MODE !== 'true') {
            return next();
        }

        if (this.isNew && !this._demoCreatedBy) {
            try {
                const session = await getSession();
                if (session && session.id) {
                    this._demoCreatedBy = session.id;
                }
            } catch (error) {
                // Ignorar errores si se ejecuta fuera de un Server Action
            }
        }
        next();
    });

    // 3. Interceptar creación en bloque (insertMany)
    schema.pre('insertMany', async function(next, docs) {
        if (process.env.IS_DEMO_MODE !== 'true') {
            return next();
        }

        try {
            const session = await getSession();
            if (session && session.id) {
                if (Array.isArray(docs)) {
                    docs.forEach(doc => {
                        if (!doc._demoCreatedBy) doc._demoCreatedBy = session.id;
                    });
                } else if (docs && !(docs as any)._demoCreatedBy) {
                    (docs as any)._demoCreatedBy = session.id;
                }
            }
        } catch (error) {}
        next();
    });

    // 4. Helper para filtrar consultas de lectura/actualización/borrado
    const applyTenantFilter = async function(this: any, next: mongoose.CallbackWithoutResultAndOptionalError) {
        if (process.env.IS_DEMO_MODE !== 'true') {
            return next();
        }

        try {
            const session = await getSession();
            // Si el usuario no es administrador, filtrar por su ID
            if (session && session.role !== 'Administrador') {
                this.where({ _demoCreatedBy: session.id });
            }
        } catch (error) {
            // Ignorar
        }
        next();
    };

    const queryMethods = [
        'find',
        'findOne',
        'countDocuments',
        'count',
        'findOneAndUpdate',
        'updateMany',
        'deleteMany',
        'findOneAndDelete'
    ];

    queryMethods.forEach((method) => {
        schema.pre(method as any, applyTenantFilter);
    });

    // 5. Interceptar Aggregations (muy importante para gráficas del Dashboard)
    schema.pre('aggregate', async function(next) {
        if (process.env.IS_DEMO_MODE !== 'true') {
            return next();
        }

        try {
            const session = await getSession();
            if (session && session.role !== 'Administrador') {
                // Insertar un $match al principio del pipeline
                this.pipeline().unshift({ $match: { _demoCreatedBy: session.id } });
            }
        } catch (error) {
            // Ignorar
        }
        next();
    });
}
