export const SERVICES = {
    API_GATEWAY: 'api-gateway',
    AUTH_SERVICE: 'auth-service',
    RESTAURANT_SERVICE: 'restaurant-service',
    RESERVATION_SERVICE: 'reservation-service',
    TABLE_SERVICE: 'table-service',
} as const;

export const SERVICES_PORTS = {
    [SERVICES.API_GATEWAY]: 3000,
    [SERVICES.AUTH_SERVICE]: 3001,
    [SERVICES.RESTAURANT_SERVICE]: 50051,
    [SERVICES.RESERVATION_SERVICE]: 3002,
    [SERVICES.TABLE_SERVICE]: 50052,
} as const;

export type ServiceName = (typeof SERVICES)[keyof typeof SERVICES];