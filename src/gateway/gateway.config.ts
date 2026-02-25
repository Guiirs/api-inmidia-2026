/**
 * API Gateway Configuration
 * 
 * Define o roteamento e configurações do gateway para cada módulo/subsistema
 */

export interface ServiceRoute {
  path: string;
  target: string;
  module: string;
  requiresAuth: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
}

export interface GatewayConfig {
  routes: ServiceRoute[];
  defaultTimeout: number;
  circuitBreaker: {
    threshold: number;
    timeout: number;
  };
}

/**
 * Configuração de rotas do gateway
 * 
 * Em produção, cada 'target' seria a URL de um microserviço
 * Ex: http://core-service:3001, http://placas-service:3002, etc
 * 
 * Atualmente, todos apontam para 'local' pois ainda é um monolito modular
 */
export const gatewayConfig: GatewayConfig = {
  // Timeout padrão para requisições (30s)
  defaultTimeout: 30000,

  // Circuit breaker: desabilita rota após X falhas
  circuitBreaker: {
    threshold: 5,      // Número de falhas para abrir o circuito
    timeout: 60000,    // Tempo para tentar reativar (1 minuto)
  },

  // Definição de rotas e seus targets
  routes: [
    // ========================================
    // CORE DOMAIN (Autenticação & Empresas)
    // ========================================
    {
      path: '/api/v1/auth/*',
      target: 'local',  // Futuramente: 'http://core-service:3001'
      module: 'auth',
      requiresAuth: false, // Login não precisa de auth
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 10, // Máximo 10 tentativas de login por IP
      },
    },
    {
      path: '/api/v1/empresas/*',
      target: 'local',
      module: 'empresas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
    },
    {
      path: '/api/v1/empresa/*',
      target: 'local',
      module: 'empresa-alias',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
    },
    {
      path: '/api/v1/users/*',
      target: 'local',
      module: 'users',
      requiresAuth: true,
    },
    {
      path: '/api/v1/admin/*',
      target: 'local',
      module: 'admin',
      requiresAuth: true, // Apenas admins
    },

    // ========================================
    // ASSET MANAGEMENT (Placas & Regiões)
    // ========================================
    {
      path: '/api/v1/placas/*',
      target: 'local',  // Futuramente: 'http://asset-service:3002'
      module: 'placas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 500, // Alta frequência de consultas
      },
    },
    {
      path: '/api/v1/regioes/*',
      target: 'local',
      module: 'regioes',
      requiresAuth: true,
    },

    // ========================================
    // CRM DOMAIN (Clientes & Aluguéis)
    // ========================================
    {
      path: '/api/v1/clientes/*',
      target: 'local',  // Futuramente: 'http://crm-service:3003'
      module: 'clientes',
      requiresAuth: true,
    },
    {
      path: '/api/v1/alugueis/*',
      target: 'local',
      module: 'alugueis',
      requiresAuth: true,
    },

    // ========================================
    // SALES & CONTRACTS (PIs & Contratos)
    // ========================================
    {
      path: '/api/v1/pis/*',
      target: 'local',  // Futuramente: 'http://sales-service:3004'
      module: 'propostas-internas',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 200,
      },
    },
    {
      path: '/api/v1/contratos/*',
      target: 'local',
      module: 'contratos',
      requiresAuth: true,
    },
    {
      path: '/api/v1/bi-weeks/*',
      target: 'local',
      module: 'biweeks',
      requiresAuth: true,
    },

    // ========================================
    // INTEGRATION LAYER (Webhooks & APIs)
    // ========================================
    {
      path: '/api/v1/webhooks/*',
      target: 'local',  // Futuramente: 'http://integration-service:3005'
      module: 'webhooks',
      requiresAuth: true,
    },
    {
      path: '/api/v1/public/*',
      target: 'local',
      module: 'public-api',
      requiresAuth: false, // API pública usa API Key
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 1000, // Alta frequência para integrações
      },
    },
    {
      path: '/api/v1/whatsapp/*',
      target: 'local',
      module: 'whatsapp',
      requiresAuth: true,
    },

    // ========================================
    // ANALYTICS & REPORTS
    // ========================================
    {
      path: '/api/v1/relatorios/*',
      target: 'local',  // Futuramente: 'http://analytics-service:3006'
      module: 'relatorios',
      requiresAuth: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 50, // Relatórios são pesados
      },
    },

    // ========================================
    // SYSTEM & HEALTH
    // ========================================
    {
      path: '/api/v1/health',
      target: 'local',
      module: 'system',
      requiresAuth: false,
    },
    {
      path: '/api/v1/system/*',
      target: 'local',
      module: 'system',
      requiresAuth: true,
    },
  ],
};

/**
 * Encontra a rota correspondente para um path
 */
export function findRoute(path: string): ServiceRoute | undefined {
  return gatewayConfig.routes.find(route => {
    const pattern = route.path.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });
}

/**
 * Verifica se um módulo está habilitado
 */
export function isModuleEnabled(_moduleName: string): boolean {
  // Em produção, isso consultaria um service registry (Consul, etcd)
  // Por enquanto, todos os módulos estão habilitados
  return true;
}
