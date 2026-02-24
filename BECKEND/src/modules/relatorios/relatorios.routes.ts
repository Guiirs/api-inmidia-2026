/**
 * Relatorios Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import Placa from '@modules/placas/Placa';
import Aluguel from '@modules/alugueis/Aluguel';
import Regiao from '@modules/regioes/Regiao';
import Cliente from '@modules/clientes/Cliente';
import { RelatorioRepository } from './repositories/relatorio.repository';
import { RelatorioService } from './services/relatorio.service';
import { RelatorioController } from './controllers/relatorio.controller';
import * as legacyRelatorioController from './relatorio.controller';
import authenticateToken from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection
const repository = new RelatorioRepository(Placa, Aluguel, Regiao, Cliente);
const service = new RelatorioService(repository);
const controller = new RelatorioController(service);

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// GET /api/v1/relatorios/dashboard-summary - Resumo do dashboard
router.get(
  '/dashboard-summary',
  controller.getDashboardSummary
);

// GET /api/v1/relatorios/placas-por-regiao - Placas agrupadas por região
router.get(
  '/placas-por-regiao',
  controller.getPlacasPorRegiao
);

// GET /api/v1/relatorios/ocupacao-por-periodo - Ocupação por período
router.get(
  '/ocupacao-por-periodo',
  controller.getOcupacaoPorPeriodo
);

// Rota de compatibilidade enquanto exportacao PDF nao e migrada para controller DI.
router.get(
  '/export/ocupacao-por-periodo',
  legacyRelatorioController.exportOcupacaoPdf
);

export default router;
