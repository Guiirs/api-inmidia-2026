import { Router } from 'express';
import { z } from 'zod';
import logger from '@shared/container/logger';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';
import { ClienteController } from './controllers/cliente.controller';
import { ClienteService } from './services/cliente.service';
import { ClienteRepository } from './repositories/cliente.repository';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { getSingleUploadMiddleware } from '@shared/infra/http/middlewares/upload.middleware';
import { CreateClienteSchema, UpdateClienteSchema } from './dtos/cliente.dto';

const router = Router();

const clienteRepository = new ClienteRepository();
const clienteService = new ClienteService(clienteRepository);
const clienteController = new ClienteController(clienteService);

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
const idParamSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID do cliente fornecido e invalido.'),
  }),
});

const createClienteSchema = z.object({ body: CreateClienteSchema });
const updateClienteSchema = z.object({
  params: z.object({
    id: z.string().regex(mongoIdRegex, 'O ID do cliente fornecido e invalido.'),
  }),
  body: UpdateClienteSchema,
});

logger.info('[Routes Clientes] Definindo rotas de Clientes...');

router.use(authenticateToken);

router.get('/', clienteController.getAllClientesController.bind(clienteController));
router.get('/:id', validate(idParamSchema), clienteController.getClienteByIdController.bind(clienteController));
router.post(
  '/',
  getSingleUploadMiddleware('logo'),
  validate(createClienteSchema),
  clienteController.createClienteController.bind(clienteController)
);
router.put(
  '/:id',
  getSingleUploadMiddleware('logo'),
  validate(updateClienteSchema),
  clienteController.updateClienteController.bind(clienteController)
);
router.delete('/:id', validate(idParamSchema), clienteController.deleteClienteController.bind(clienteController));

logger.info('[Routes Clientes] Rotas de Clientes definidas com sucesso.');

export default router;
