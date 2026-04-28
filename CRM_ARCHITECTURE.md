# Manual de Lógica y Arquitectura de Zarela ERP

Este documento describe a profundidad la arquitectura de datos, los flujos (workflows) de negocio y la lógica integrada de Zarela ERP. Sirve como referencia técnica para entender cómo interactúan los distintos módulos entre sí, especialmente en áreas de sincronización de inventario, finanzas y reportes a la DGII (Facturación Electrónica e-CF).

---

## 1. Arquitectura Base
El sistema es una aplicación monolítica "Fullstack" desarrollada en **Next.js (App Router)** usando rutinas de servidor (`Server Actions`), con una base de datos NoSQL documental en **MongoDB (Mongoose)** y estilizada con **Tailwind CSS + Shadcn UI**. 

Es un sistema cerrado mediante autenticación (NextAuth) basado en un sistema de Roles (`Administrador`, `Vendedor`, `Almacén`). Todo dato se procesa del cliente (`use client`) hacia Servidor (`"use server"`) para evitar manipulación de montos o validaciones críticas desde el navegador.

---

## 2. Modelos Centrales y su Lógica

La lógica del negocio pivota alrededor de **6 pilares**: Contactos, Inventario, Ingresos, Egresos, Configuración Genérica y el Motor Fiscal (e-CF).

### A. Gestión de Contactos (Clientes y Proveedores)
**Modelo:** `Client`
*   **Lógica:** Almacena todos los actores externos de la empresa. Diferencia entre "Persona Física" y "Jurídica" para el manejo de comprobantes fiscales (RNC vs Cédula). 
*   **Balance y Crédito:** El sistema rige un concepto de `creditLimit` y `balance` (deuda viva). Cuando a un cliente se le emite una factura a crédito, el `balance` sube. Cuando emite pagos, el `balance` baja.

### B. Inventario y Movimientos
**Modelos:** `Product` | `InventoryMovement`
*   **Lógica Base:** El `Product` guarda el precio maestro, costo y el `stock` actual.
*   **Trazabilidad:** *Nunca* se modifica el stock de un producto mágicamente. Todo cambio genera una traza inmutable en `InventoryMovement` especificando tipo (`ENTRADA`, `SALIDA`, `AJUSTE`) junto con la fecha y el empleado que lo realizó (`User`). Esto previene robos descuadrados.
*   **Impacto Automático:** Al generar una Factura, el sistema dispara automáticamente movimientos de tipo `SALIDA`.

### C. Ciclo de Ingresos (Cotización -> Facturación -> Pagos)
**Modelos:** `Invoice` | `Payment` | `CreditNote`
*   **Facturación:** El registro maestro recae en `Invoice`. El estado de una factura se calcula matemáticamente:
    * `total` = suma de items (cantidad * precio) - descuentos + ITBIS.
    * `paidAmount` = suma matemática de todos sus pagos (`Payment`).
    * **Status Dinámico:** Si `paidAmount` == `total` -> `Pagada`. Si `paidAmount` < `total` -> `Parcial`. Si fecha vencimiento pasó -> `Vencida`.
*   **Secuencias (NCF):** Al guardar una factura, el sistema consume una secuencia del modelo `Sequence` (Ej: Incrementa B01 para Consumidor Final, E31 para Crédito Fiscal).
*   **Notas de Crédito:** Un modelo propio `CreditNote` que hace referencia obligatoria al `Invoice` original. Restaura inventario si se devuelve producto.

### D. Ciclo de Egresos (Gastos y Proveedores)
**Modelos:** `Expense` | `ExpenseTransaction` | `RecurringExpense`
*   **Gastos Puntuales:** Un `Expense` guarda el costo asociado a la empresa (Nómina, Mantenimiento, Compra a Suplidor). Al igual que Invoices, tiene pagos parciales registrados en `ExpenseTransaction`.
*   **Gastos Recurrentes:** Emplea un sistema ("cron-like" o al evaluar rutas) que chequea `RecurringExpense`. Si un gasto `Activo` tiene una fecha `nextRun` en el pasado, el sistema clona los datos hacia un `Expense` real y recalcula el próximo vencimiento (`nextRun` + Frecuencia Mensual/Semanal).

### E. Integración Gubernamental de DGII (Motor e-CF)
Esta es la capa más compleja e invasiva del sistema.
**Modelos inyectados:** `(Todos)` + `EcfAuditLog`
*   El ERP tiene un "Modo DGII" activable. Al estar activo, la mecánica estándar de facturas se expande:
    1.  **Firma XML:** En lugar de emitir un PDF para base de datos interna, el ERP usa el certificado digital interno (`.p12`) para construir un payload XML de un "e-NCF".
    2.  **Transmisión (`TrackId`):** El XML firmado se despacha por HTTP a la Dirección General de Impuestos Internos (DGII). La respuesta inicial devuelve un `TrackId`.
    3.  **Auditoría y Lógica Asíncrona:** El documento original (`Invoice` o `Expense`) se guarda con estado e-CF `Pendiente`. Un administrador luego chequea el estado usando el `TrackId` y la factura se marca `Aceptado` o `Rechazado` basado en dictamen de gobierno.
    4.  **Certidumbre Total (`EcfAuditLog`):** Absolutamente **TODO** requerimiento HTTP a la DGII y su respuesta exacta se encripta de manera temporal y se guarda en `EcfAuditLog` para propósitos forenses. En caso de discrepancia contable, el administrador interroga el dashboard `/ecf-logs` para revisar el motivo real del rechazo a nivel técnico.

### F. Control de Acceso y Configuración
*   **Roles:** 
    *   `Almacén`: Limitado al CRUD de Inventario y Movimientos.
    *   `Vendedor`: Limitado a ver sus propias Facturas y Clientes no financieros críticos.
    *   `Admin`: Control absoluto (Gastos, Configuraciones de DGII, etc).
*   **Settings (`Configuration`):** Modelo clave-valor que permite agregar categorías de inventario sin redesplegar código.

---

## 3. Resumen del Flujo Financiero Cruzado (Data Flow)

Si el vendedor "Juan" crea una factura de un "Paquete de Chorizos" por $1000 que el cliente no ha pagado:

1.  **Inventario:** El Stock del producto baja -1. Se crea un `InventoryMovement` negativo.
2.  **Cliente:** El `balance` (Deuda) del cliente sube en +$1000.
3.  **Factura:** Queda en Status `Pendiente` (`paidAmount` = 0).
4.  **DGII (Si e-CF está vivo):** El sistema despacha XML a DGII, y el `ecfStatus` se marca `Pendiente`. Se inserta un record en `EcfAuditLog`.
5.  **Días después (El Cliente Paga):** Juan ingresa al modulo *Transacciones* o *Facturas* y registra un Pago (`Payment`) de $1000 en Efectivo.
6.  **Resolución Automática:**
    *   La base de datos recalcula. Ve que Total=$1000 y Paid=$1000.
    *   Factura cambia `Status` -> `Pagada`.
    *   El `balance` del Cliente baja en -$1000.
    *   El reporte de Ingresos Diarios ahora suma esos +$1000 en efectivo a los totales de caja.

Este principio de **efectos en cascada atómicos y basados en registros secundarios** asegura la integridad del ERP (si la DB se apaga a la mitad de una transacción parcial de un servidor, no hay descuadres invisibles).
