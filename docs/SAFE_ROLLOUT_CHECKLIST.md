# Checklist de Pase Seguro

## Antes del despliegue

- Confirmar backup reciente de MongoDB.
- Verificar que el usuario administrador actual puede iniciar sesión en el entorno actual.
- Confirmar valores de `JWT_SECRET`, `ECF_CERTIFICATE_BASE64`, `ECF_CERTIFICATE_PASSPHRASE` y `ECF_RNC_EMISOR`.
- Definir `SIGN_XML_INTERNAL_TOKEN` si `api/sign-xml` seguirá habilitado en producción.
- Ejecutar `npm run test:ecf-regression`.
- Validar que las secuencias `E31`, `E32`, `E33`, `E34`, `E41`, `E43`, `E44`, `E45`, `E46` y `E47` coinciden con MongoDB.

## Smoke tests posteriores al despliegue

- Login del administrador actual sin recrear usuarios.
- Carga de dashboard, facturas, pagos, gastos y monitor e-CF.
- Descarga interna de XML firmado desde `/api/ecf/download`.
- Recepción pública DGII:
  - `GET /fe/recepcion/api/ecf`
  - `GET /fe/aprobacioncomercial/api/ecf`
  - `GET /fe/autenticacion/api/validacioncertificado`
- Envío de un comprobante de prueba hacia DGII en el ambiente configurado.
- Consulta de estado de un e-CF existente.

## Verificaciones de compatibilidad

- Abrir facturas, notas, gastos y auditorías históricas.
- Verificar que el admin existente mantiene su rol y acceso.
- Confirmar que las URLs previas de adjuntos en `public/uploads` siguen resolviendo.
- Confirmar que la contingencia conserva estado después de reiniciar la app.
