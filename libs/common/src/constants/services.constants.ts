export const SERVICES = {
    API_GATEWAY: 'api-gateway',
    AUTH_SERVICE: 'auth-service',
    RESTAURANT_SERVICE: 'restaurant-service',
    RESERVATION_SERVICE: 'reservation-service',
    TABLE_SERVICE: 'table-service',
    NOTIFICATION_SERVICE: 'notification-service',
    EMAIL_SERVICE: 'email-service',
} as const;

export const SERVICES_PORTS = {
    [SERVICES.API_GATEWAY]: 3000,
    [SERVICES.AUTH_SERVICE]: 3001,
    [SERVICES.RESTAURANT_SERVICE]: 50051,
    [SERVICES.TABLE_SERVICE]: 50052,
    [SERVICES.RESERVATION_SERVICE]: 50053,
    [SERVICES.NOTIFICATION_SERVICE]: 3003,
    [SERVICES.EMAIL_SERVICE]: 3004,
} as const;

export type ServiceName = (typeof SERVICES)[keyof typeof SERVICES];