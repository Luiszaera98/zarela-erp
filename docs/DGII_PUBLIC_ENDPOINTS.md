# Matriz de Endpoints Públicos DGII

Estos endpoints deben seguir siendo públicos porque la DGII o terceros emisores pueden consumirlos sin autenticación interactiva:

- `/fe/recepcion/api/ecf`
- `/fe/aprobacioncomercial/api/ecf`
- `/fe/autenticacion/api/ValidacionCertificado`
- `/fe/autenticacion/api/validacioncertificado`
- `/fe/autenticacion/api/:path*`
- `/autenticacion/api/:path*`

## Reglas operativas

- No colocar login, Cloudflare Access ni validaciones de sesión sobre estas rutas.
- Mantener validación estricta de método, `content-type` y tamaño de payload.
- Limitar logs para no exponer datos fiscales completos.
- Las rutas administrativas o utilitarias internas deben protegerse aparte.

## Endpoints internos endurecidos

- `/api/sign-xml`
- `/api/ecf/download`
- Server actions de clientes, inventario, facturas, pagos, gastos y configuración

Estos sí deben depender de sesión y/o rol, porque no forman parte del contrato público de DGII.
