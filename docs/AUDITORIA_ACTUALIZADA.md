# Auditoría Actualizada — Zarela ERP

**Fuente original:** `/Users/luiszaera/Downloads/AUDITORIA.md`  
**Actualizado después de la remediación inicial:** 23-04-2026  
**Objetivo:** reflejar qué hallazgos fueron confirmados, cuáles ya se corrigieron, cuáles siguen pendientes y cuáles estaban inflados o incorrectos.

---

## Resumen Ejecutivo Actualizado

La auditoría original fue útil, pero no todo tenía la misma severidad ni todo estaba correctamente descrito.

### Estado general después de esta implementación

- **Corregidos en esta fase:** 14 hallazgos relevantes
- **Pendientes de siguiente fase:** 11 hallazgos relevantes
- **Parciales / requieren matiz:** 5 hallazgos
- **Incorrectos o no sustentados como estaban escritos:** 3 hallazgos

### Restricciones que guiaron la implementación

- No romper la lógica e-CF ya certificada ante DGII.
- Mantener públicos los endpoints que consume la DGII.
- No tocar destructivamente el usuario administrador actual ni la data ya existente.
- Mantener compatibilidad con el entorno real: servidor Ubuntu viejo + Cloudflare Tunnel.

---

## Hallazgos Confirmados y Ya Corregidos

### 1. Middleware sin verificación criptográfica real
**Estado:** Corregido  
**Qué se hizo:** `src/middleware.ts` ahora valida la sesión real y aplica control de acceso por rol en rutas internas.

### 2. JWT con fallback inseguro
**Estado:** Mitigado de forma compatible  
**Qué se hizo:** se centralizó la resolución del secreto en `src/lib/auth/session.ts`.  
**Matiz:** para no romper sesiones/ambientes existentes, se dejó compatibilidad controlada si aún no existe `JWT_SECRET`, pero el pase a producción debe configurarlo explícitamente.

### 3. Passwords por defecto en auto-seed
**Estado:** Corregido  
**Qué se hizo:** `src/lib/actions/authActions.ts` ya no hace auto-seed si faltan `ADMIN_PASSWORD`, `SALES_PASSWORD` e `INVENTORY_PASSWORD`.  
**Compatibilidad:** no se toca el admin existente.

### 4. Cookie sin `secure` ni `sameSite`
**Estado:** Corregido  
**Qué se hizo:** la cookie de sesión ahora usa opciones endurecidas según entorno/URL pública.

### 5. Path traversal en `/api/uploads/[...path]`
**Estado:** Corregido  
**Qué se hizo:** se normaliza y valida la ruta, rechazando `..`, separadores embebidos y escapes fuera de `public/uploads`.

### 6. Password en texto plano al crear vendedores importados
**Estado:** Corregido  
**Qué se hizo:** ahora se usa `bcrypt` en `src/lib/actions/invoiceActions.ts`.

### 7. `cleanupAllPayments` sin autorización
**Estado:** Corregido  
**Qué se hizo:** solo `Administrador` puede ejecutarlo y ahora además genera backup lógico previo.

### 8. `api/sign-xml` expuesto y dejando el certificado en disco
**Estado:** Corregido / encapsulado  
**Qué se hizo:** en producción requiere sesión admin o `SIGN_XML_INTERNAL_TOKEN`; además el `.p12` temporal se elimina siempre.

### 9. Falta de autorización real en server actions
**Estado:** Corregido en las áreas más sensibles  
**Qué se hizo:** se agregó control server-side para clientes, inventario, facturas, pagos, gastos, settings y acciones internas e-CF.  
**Nota:** este hallazgo era más importante que varios puntos de la auditoría original.

### 10. Upload sin validación de tipo y tamaño
**Estado:** Corregido  
**Qué se hizo:** `src/lib/actions/uploadActions.ts` ahora valida MIME y límite de 5 MB.

### 11. Contingencia almacenada solo en memoria
**Estado:** Corregido  
**Qué se hizo:** ahora persiste en Mongo usando `Configuration`, con diseño compatible y sin migración destructiva.

### 12. Logging sensible en flujo e-CF
**Estado:** Parcialmente corregido  
**Qué se hizo:** se eliminaron logs innecesarios de QR y se redujo exposición de respuestas sensibles DGII en puntos clave.

### 13. Importación con `Math.random()` para IDs
**Estado:** Corregido en los flujos tocados  
**Qué se hizo:** se reemplazó por `randomUUID()` donde aplicaba en importación.

### 14. Falta de regresión automatizada para e-CF
**Estado:** Corregido en base mínima  
**Qué se hizo:** se agregó `scripts/regression/ecf-regression.cjs` y el script `npm run test:ecf-regression`.

---

## Hallazgos Pendientes

Estos siguen siendo válidos y deberían entrar en la siguiente fase.

### A. Rate limiting en login
**Estado:** Pendiente  
**Comentario:** sigue siendo importante, especialmente si el panel se expone más allá del túnel o si se publica con dominio estable.

### B. Validación formal de inputs con esquema
**Estado:** Pendiente  
**Comentario:** todavía no se introdujo `zod` ni validación estructurada general en server actions.

### C. Cálculos financieros generales con `float`
**Estado:** Pendiente con mucha cautela  
**Comentario:** el riesgo existe, pero tocar esto requiere regresión fuerte porque puede afectar flujos fiscales ya estabilizados.

### D. Retry sin transacción real cuando no hay replica set
**Estado:** Pendiente  
**Comentario:** sigue existiendo el fallback de `runTransaction()` sin sesión real; se aceptó por compatibilidad operativa con tu hardware actual.

### E. Concurrencia de stock
**Estado:** Pendiente  
**Comentario:** todavía existe ventana entre validación y decremento. Es un riesgo real en concurrencia alta.

### F. Certificado expirado / alertas operativas
**Estado:** Pendiente  
**Comentario:** aún no hay verificación de vencimiento ni alertas previas.

### G. Health checks
**Estado:** Pendiente  
**Comentario:** falta endpoint de salud con DB, certificado y conectividad DGII.

### H. Backup automático
**Estado:** Pendiente  
**Comentario:** se agregó backup lógico para limpieza de pagos, pero no un sistema general automático.

### I. Hardening de importación masiva
**Estado:** Parcial  
**Comentario:** ya hay límite básico por lote y mejoras de IDs, pero falta validación estructurada completa.

### J. Tipado `any` y manejo de errores genéricos
**Estado:** Pendiente  
**Comentario:** sigue siendo deuda técnica importante, aunque no crítica para el pase.

### K. Tests más amplios
**Estado:** Pendiente  
**Comentario:** la regresión actual cubre e-CF base, pero faltan pruebas de auth, stock, importación y compatibilidad de datos históricos.

---

## Hallazgos Parciales o con Severidad Inflada

### 1. “Docker-compose expone credenciales” como crítico absoluto
**Estado:** Parcial  
**Comentario:** sí había defaults inseguros, pero en tu caso Mongo no estaba publicado abiertamente en producción por diseño. Sigue siendo una mejora importante, no necesariamente un “critical” aislado.

### 2. “No hay README de despliegue”
**Estado:** Parcial  
**Comentario:** sí existe `README.md`, aunque necesitaba actualizarse al entorno real. Ya se mejoró y se agregaron docs adicionales.

### 3. “Console.log expone datos sensibles” en todos los casos
**Estado:** Parcial  
**Comentario:** había hallazgos reales, pero no todos tenían el mismo impacto. Se corrigieron los más delicados del flujo fiscal.

### 4. “Importación sin validación ni límite”
**Estado:** Parcial  
**Comentario:** ya no está completamente abierta como antes, aunque todavía no tiene validación formal completa por schema.

### 5. “Transacciones con retry silencioso” como bloqueo inmediato de producción
**Estado:** Parcial  
**Comentario:** el riesgo existe, pero por tu infraestructura actual no era razonable forzar replica set en esta fase sin medir impacto.

---

## Hallazgos Incorrectos o No Sustentados como Estaban Escritos

### 1. CORS abierto en `next.config.js`
**Estado:** Incorrecto  
**Comentario:** no había evidencia de cabeceras CORS abiertas en `next.config.js`.

### 2. “Sin índices en MongoDB”
**Estado:** Incorrecto  
**Comentario:** sí existen índices en varios modelos (`Invoice`, `Payment`, `CreditNote`, `DebitNote`, `Expense`, `EcfAuditLog`, etc.).

### 3. “Generación de NCF sin atomización”
**Estado:** Incorrecto como afirmación literal  
**Comentario:** `getNextNCF` y `getNextENCF` ya usan `$inc` con `findOneAndUpdate`; el problema real no era falta de atomización de secuencia, sino robustez alrededor de transacciones y concurrencia general.

---

## Cambios Implementados en Esta Fase

### Seguridad y acceso

- Nuevo módulo de sesión compartido: `src/lib/auth/session.ts`
- Middleware endurecido: `src/middleware.ts`
- Layout usando sesión real: `src/app/(app)/layout.tsx`
- Protección server-side en acciones críticas:
  - `clientActions.ts`
  - `inventoryActions.ts`
  - `invoiceActions.ts`
  - `paymentActions.ts`
  - `expenseActions.ts`
  - `settingsActions.ts`
  - `ecfActions.ts`

### Superficie pública / interna

- `docs/DGII_PUBLIC_ENDPOINTS.md` documenta qué rutas deben seguir públicas.
- `src/app/api/ecf/download/route.ts` ahora exige sesión.
- `src/app/api/sign-xml/route.ts` quedó encapsulado para producción.

### Archivos y adjuntos

- Protección contra traversal en `src/app/api/uploads/[...path]/route.ts`
- Validación de uploads en `src/lib/actions/uploadActions.ts`

### Compatibilidad operacional

- Persistencia de contingencia compatible en `src/lib/actions/ecfContingencyActions.ts`
- Backup lógico previo a limpieza masiva de pagos en `src/lib/actions/paymentActions.ts`
- Documentación de pase seguro en `docs/SAFE_ROLLOUT_CHECKLIST.md`

### Regresión fiscal

- Nuevo script: `scripts/regression/ecf-regression.cjs`
- Nuevo comando: `npm run test:ecf-regression`

---

## Validación Ejecutada

Después de esta fase se validó:

- `npm run test:ecf-regression`
- `./node_modules/.bin/tsc --noEmit`

Ambas pasaron correctamente en el estado actual del repositorio.

---

## Recomendación para la Siguiente Fase

Orden recomendado:

1. Rate limiting en login y rutas internas sensibles.
2. Validación estructurada con `zod` en imports, facturas, pagos y gastos.
3. Health checks y verificación de certificado próximo a vencer.
4. Revisión de concurrencia de stock y estrategia para transacciones en tu entorno real.
5. Expansión de la suite de regresión:
   - auth/roles
   - compatibilidad con data histórica
   - smoke tests de endpoints DGII públicos
   - importación y adjuntos

---

## Estado Actual de Preparación

**Conclusión práctica:** el sistema quedó significativamente más seguro y más listo para un pase serio, sin romper el comportamiento fiscal validado ni tocar destructivamente la data existente.  
**Pero** todavía no debe considerarse “cerrado” el tema de seguridad/operación hasta completar la siguiente tanda de rate limiting, validación de inputs, health checks y pruebas ampliadas.
