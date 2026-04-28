/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    async rewrites() {
        return [
            {
                source: '/uploads/:path*',
                destination: '/api/uploads/:path*',
            },
            // DGII E-CF Standard Endpoints
            {
                source: '/fe/recepcion/api/ecf',
                destination: '/api/ecf/receiver',
            },
            {
                source: '/fe/aprobacioncomercial/api/ecf',
                destination: '/api/ecf/commercial-approval',
            },
            {
                source: '/fe/autenticacion/api/ValidacionCertificado',
                destination: '/api/ecf/auth/validacioncertificado',
            },
            {
                source: '/fe/autenticacion/api/validacioncertificado',
                destination: '/api/ecf/auth/validacioncertificado',
            },
            {
                source: '/fe/autenticacion/api/:path*',
                destination: '/api/ecf/auth/:path*',
            },
            {
                source: '/autenticacion/api/:path*',
                destination: '/api/ecf/auth/:path*',
            }
        ];
    },
};

module.exports = nextConfig;
