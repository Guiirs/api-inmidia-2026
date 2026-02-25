/**
 * Registro Central de Módulos
 * 
 * Define todos os módulos disponíveis na aplicação e suas configurações
 */

import { Router } from 'express';

// Import de rotas dos módulos
import authRoutes from '@modules/auth/auth.routes';
import userRoutes from '@modules/users/user.routes';
import empresaRoutes from '@modules/empresas/empresa.routes';
import empresaPublicRoutes from '@modules/empresas/empresa-public.routes';
import clienteRoutes from '@modules/clientes/cliente.routes';
import placaRoutes from '@modules/placas/placas.routes';
import regiaoRoutes from '@modules/regioes/regiao.routes';
import aluguelRoutes from '@modules/alugueis/aluguel.routes';
import piRoutes from '@modules/propostas-internas/pi.routes';
import contratoRoutes from '@modules/contratos/contrato.routes';
import biWeekRoutes from '@modules/biweeks/biWeeks.routes';
import webhookRoutes from '@modules/webhooks/webhook.routes';
import publicApiRoutes from '@modules/public-api/public-api.routes';
import relatorioRoutes from '@modules/relatorios/relatorios.routes';
import whatsappRoutes from '@modules/whatsapp/whatsapp.routes';
import adminRoutes from '@modules/admin/admin.routes';
import checkingRoutes from '@modules/checking/checking.routes';
import queueRoutes from '@modules/system/queue/queue.routes';
import sseRoutes from '@modules/system/sse/sse.routes';

export interface ModuleDefinition {
  name: string;
  basePath: string;
  router: Router;
  description: string;
  domain: string;
  version: string;
  enabled: boolean;
}

/**
 * Definição de todos os módulos da aplicação
 * Organizados por domínio de negócio
 */
export const modules: ModuleDefinition[] = [
  // ========================================
  // CORE DOMAIN - Autenticação & Empresas
  // ========================================
  {
    name: 'auth',
    basePath: '/api/v1/auth',
    router: authRoutes,
    description: 'Autenticação e autorização de usuários',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'users',
    basePath: '/api/v1/user',
    router: userRoutes,
    description: 'Gestão de usuários do sistema',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'empresas',
    basePath: '/api/v1/empresas',
    router: empresaRoutes,
    description: 'Gestão de empresas (multi-tenant)',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'empresa-alias',
    basePath: '/api/v1/empresa',
    router: empresaRoutes,
    description: 'Alias para empresas (compatibilidade)',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'empresa-public',
    basePath: '/api/v1/public/empresas',
    router: empresaPublicRoutes,
    description: 'Rotas públicas de empresas (registro)',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'admin',
    basePath: '/api/v1/admin',
    router: adminRoutes,
    description: 'Funcionalidades administrativas',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },

  // ========================================
  // ASSET MANAGEMENT - Placas & Regiões
  // ========================================
  {
    name: 'placas',
    basePath: '/api/v1/placas',
    router: placaRoutes,
    description: 'Gestão de placas publicitárias',
    domain: 'asset-management',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'regioes',
    basePath: '/api/v1/regioes',
    router: regiaoRoutes,
    description: 'Gestão de regiões geográficas',
    domain: 'asset-management',
    version: '1.0.0',
    enabled: true,
  },

  // ========================================
  // CRM DOMAIN - Clientes & Aluguéis
  // ========================================
  {
    name: 'clientes',
    basePath: '/api/v1/clientes',
    router: clienteRoutes,
    description: 'Gestão de clientes (CRM)',
    domain: 'crm',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'alugueis',
    basePath: '/api/v1/alugueis',
    router: aluguelRoutes,
    description: 'Gestão de aluguéis de placas',
    domain: 'crm',
    version: '1.0.0',
    enabled: true,
  },

  // ========================================
  // SALES & CONTRACTS - PIs & Contratos
  // ========================================
  {
    name: 'propostas-internas',
    basePath: '/api/v1/pis',
    router: piRoutes,
    description: 'Propostas Internas (orçamentos)',
    domain: 'sales',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'contratos',
    basePath: '/api/v1/contratos',
    router: contratoRoutes,
    description: 'Gestão de contratos formais',
    domain: 'sales',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'biweeks',
    basePath: '/api/v1/bi-weeks',
    router: biWeekRoutes,
    description: 'Sistema de quinzenas/períodos',
    domain: 'sales',
    version: '1.0.0',
    enabled: true,
  },

  // ========================================
  // INTEGRATION LAYER - Webhooks & APIs
  // ========================================
  {
    name: 'webhooks',
    basePath: '/api/v1/webhooks',
    router: webhookRoutes,
    description: 'Sistema de webhooks para integrações',
    domain: 'integration',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'public-api',
    basePath: '/api/v1/public',
    router: publicApiRoutes,
    description: 'API pública para parceiros',
    domain: 'integration',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'whatsapp',
    basePath: '/api/v1/whatsapp',
    router: whatsappRoutes,
    description: 'Integração com WhatsApp',
    domain: 'integration',
    version: '1.0.0',
    enabled: true,
  },

  // ========================================
  // ANALYTICS & REPORTS
  // ========================================
  {
    name: 'relatorios',
    basePath: '/api/v1/relatorios',
    router: relatorioRoutes,
    description: 'Relatórios e dashboards',
    domain: 'analytics',
    version: '1.0.0',
    enabled: true,
  },

  // ========================================
  // SYSTEM - Health & Monitoring
  // ========================================
  {
    name: 'checking',
    basePath: '/api/v1/checking',
    router: checkingRoutes,
    description: 'Health checks, validações e monitoramento do sistema',
    domain: 'system',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'queue',
    basePath: '/api/v1/queue',
    router: queueRoutes,
    description: 'Fila de jobs e geraÃ§Ã£o assÃ­ncrona de PDFs',
    domain: 'system',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'sse',
    basePath: '/api/v1/sse',
    router: sseRoutes,
    description: 'Server-Sent Events para notificaÃ§Ãµes em tempo real',
    domain: 'system',
    version: '1.0.0',
    enabled: true,
  },
];

/**
 * Retorna módulos agrupados por domínio
 */
export function getModulesByDomain(): Map<string, ModuleDefinition[]> {
  const byDomain = new Map<string, ModuleDefinition[]>();
  
  modules.forEach(module => {
    if (!byDomain.has(module.domain)) {
      byDomain.set(module.domain, []);
    }
    byDomain.get(module.domain)!.push(module);
  });
  
  return byDomain;
}

/**
 * Retorna módulo por nome
 */
export function getModuleByName(name: string): ModuleDefinition | undefined {
  return modules.find(m => m.name === name);
}

/**
 * Retorna apenas módulos habilitados
 */
export function getEnabledModules(): ModuleDefinition[] {
  return modules.filter(m => m.enabled);
}

/**
 * Estatísticas dos módulos
 */
export function getModuleStats() {
  const byDomain = getModulesByDomain();
  const stats = {
    total: modules.length,
    enabled: modules.filter(m => m.enabled).length,
    disabled: modules.filter(m => !m.enabled).length,
    domains: Array.from(byDomain.entries()).map(([domain, mods]) => ({
      domain,
      count: mods.length,
      modules: mods.map(m => ({ name: m.name, enabled: m.enabled })),
    })),
  };
  
  return stats;
}
