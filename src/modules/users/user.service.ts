/**
 * User Service (OLD)
 * DEPRECADO: Use services/user.service.ts
 */
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import User from './User';
import Empresa from '../empresas/Empresa';
import logger from '../../shared/container/logger';
import AppError from '../../shared/container/AppError';

const saltRounds = 10;

interface UserProfile {
    username: string;
    email: string;
    nome?: string;
    telefone?: string;
    role?: string;
    empresaId?: string;
}

interface UpdateUserData {
    username?: string;
    email?: string;
    nome?: string;
    telefone?: string;
    password?: string;
}

interface EmpresaProfile {
    nome: string;
    api_key_prefix?: string;
    status_assinatura?: string;
}

interface RegenerateApiKeyResult {
    fullApiKey: string;
    newPrefix: string;
}

interface AuditData {
    ip_address?: string;
    user_agent?: string;
}

class UserService {
    constructor() {}

    private isAdminRole(userRole: string): boolean {
        const normalizedRole = String(userRole || '').trim().toLowerCase();
        return normalizedRole === 'admin' || normalizedRole === 'superadmin';
    }

    /**
     * Obtém os dados do perfil de um utilizador.
     */
    async getProfile(userId: string): Promise<UserProfile> {
        logger.info(`[UserService] Buscando perfil para utilizador ID: ${userId}.`);
        try {
            const user = await User.findById(userId)
                                   .select('username email nome telefone role empresa')
                                   .lean()
                                   .exec();

            if (!user) {
                throw new AppError('Utilizador não encontrado.', 404);
            }

            logger.info(`[UserService] Perfil do utilizador ${user.username} (ID: ${userId}) encontrado.`);
            const profile = user as any;
            return {
                username: profile.username,
                email: profile.email,
                nome: profile.nome,
                telefone: profile.telefone,
                role: profile.role,
                empresaId: profile.empresaId || (profile.empresa ? String(profile.empresa) : undefined),
            };
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            logger.error(`[UserService] Erro Mongoose/DB ao buscar perfil do utilizador ${userId}: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao buscar perfil: ${error.message}`, 500);
        }
    }

    /**
     * Atualiza os dados do perfil de um utilizador.
     */
    async updateProfile(userId: string, userData: UpdateUserData): Promise<UserProfile> {
        logger.info(`[UserService] Tentando atualizar perfil para utilizador ID: ${userId}.`);
        const { username, email, nome, telefone, password } = userData;

        const updateData: any = {};
        if (username !== undefined && username !== null) updateData.username = username.trim();
        if (email !== undefined && email !== null) updateData.email = email.trim().toLowerCase();
        if (nome !== undefined && nome !== null) updateData.nome = nome.trim();
        if (telefone !== undefined && telefone !== null) updateData.telefone = telefone.trim();

        if (password && password.trim().length >= 6) {
            updateData.senha = await bcrypt.hash(password, saltRounds);
        } else if (password && password.trim().length > 0) {
             throw new AppError('A nova senha deve ter no mínimo 6 caracteres.', 400);
        }

        if (Object.keys(updateData).length === 0) {
            return await this.getProfile(userId); 
        }

        try {
            const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true })
                                          .select('username email nome telefone role empresa')
                                          .lean()
                                          .exec();

            if (!updatedUser) {
                throw new AppError('Utilizador não encontrado para atualização.', 404);
            }
            logger.info(`[UserService] Perfil do utilizador ${updatedUser.username} (ID: ${userId}) atualizado com sucesso.`);
            const profile = updatedUser as any;
            return {
                username: profile.username,
                email: profile.email,
                nome: profile.nome,
                telefone: profile.telefone,
                role: profile.role,
                empresaId: profile.empresaId || (profile.empresa ? String(profile.empresa) : undefined),
            };
        } catch (error: any) {
             logger.error(`[UserService] Erro Mongoose/DB ao atualizar perfil do utilizador ${userId}: ${error.message}`, { stack: error.stack, code: error.code, keyValue: error.keyValue });

            if (error.code === 11000) {
                 let field = Object.keys(error.keyValue)[0];
                 field = field === 'email' ? 'e-mail' : (field === 'username' ? 'nome de utilizador' : field);
                 throw new AppError(`Este ${field} já está em uso.`, 409);
            }
             
            if (error.name === 'ValidationError') {
                 const firstValidationError = Object.values(error.errors || {})[0] as any;
                 const firstErrorMessage = firstValidationError?.message || 'Dados inválidos';
                 throw new AppError(`Erro de validação: ${firstErrorMessage}`, 400);
            }
             
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao atualizar perfil: ${error.message}`, 500);
        }
    }

    /**
     * Obtém os dados da empresa associada ao utilizador (apenas para admins).
     */
    async getEmpresaProfile(empresa_id: string, userRole: string): Promise<EmpresaProfile> {
        logger.info(`[UserService] Utilizador (Role: ${userRole}) buscando perfil da empresa ID: ${empresa_id}.`);

        if (!this.isAdminRole(userRole)) {
            throw new AppError('Apenas administradores podem aceder aos detalhes da empresa.', 403);
        }

        try {
            const empresa = await Empresa.findById(empresa_id)
                                         .select('nome api_key_prefix status_assinatura')
                                         .lean()
                                         .exec();

            if (!empresa) {
                throw new AppError('Empresa não encontrada.', 404);
            }

            logger.info(`[UserService] Perfil da empresa ${empresa.nome} (ID: ${empresa_id}) encontrado.`);
            return empresa as EmpresaProfile;
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            logger.error(`[UserService] Erro Mongoose/DB ao buscar perfil da empresa ${empresa_id}: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao buscar perfil da empresa: ${error.message}`, 500);
        }
    }

    /**
     * Regenera a API Key de uma empresa, verificando a senha do admin.
     */
    async regenerateApiKey(
        userId: string, 
        empresaId: string, 
        userRole: string, 
        userPassword: string, 
        auditData: AuditData = {}
    ): Promise<RegenerateApiKeyResult> {
        logger.info(`[UserService] Utilizador ${userId} (Role: ${userRole}) tentando regenerar API Key para empresa ${empresaId}.`);

        if (!this.isAdminRole(userRole)) {
            throw new AppError('Apenas administradores podem regenerar a chave de API.', 403);
        }

        if (!userPassword) {
            throw new AppError('A senha atual é obrigatória para regenerar a chave.', 400);
        }

        try {
            logger.debug(`[UserService] Buscando usuário com _id: ${userId} e empresa: ${empresaId}`);
            
            // Verificar primeiro se o usuário existe e qual campo ele tem
            const userTest = await User.findById(userId).lean().exec();
            logger.debug(`[UserService] Usuário completo no banco: ${JSON.stringify(userTest)}`);
            
            if (!userTest) {
                throw new AppError('Utilizador não encontrado.', 404);
            }
            
            // Verificar qual campo existe: empresa ou empresaId
            const empresaField = userTest.empresa || userTest.empresaId;
            logger.debug(`[UserService] Campo empresa do usuário: ${empresaField}`);
            logger.debug(`[UserService] Empresa esperada: ${empresaId}`);
            logger.debug(`[UserService] Match: ${String(empresaField) === String(empresaId)}`);
            
            // Verificar se o usuário pertence à empresa
            if (String(empresaField) !== String(empresaId)) {
                throw new AppError('Utilizador administrador não encontrado para esta empresa.', 404);
            }
            
            // Buscar usuário com senha (tentar ambos os campos)
            const user = await User.findById(userId).select('+senha +password').lean().exec();
            
            if (!user) {
                throw new AppError('Utilizador administrador não encontrado para esta empresa.', 404);
            }
            
            logger.debug(`[UserService] Usuário encontrado com sucesso`);
            
            // Usar senha ou password, dependendo do que existe no banco
            const senhaHash = (user as any).senha || (user as any).password;
            
            if (!senhaHash) {
                logger.error(`[UserService] Nenhum campo de senha encontrado para usuário ${userId}`);
                throw new AppError('Erro ao verificar senha.', 500);
            }
            
            logger.debug(`[UserService] Campo de senha encontrado. Verificando...`);

            const passwordMatch = await bcrypt.compare(userPassword, senhaHash);
            if (!passwordMatch) {
                throw new AppError('Senha incorreta. Verificação falhou.', 401);
            }
            logger.debug(`[UserService] Senha do admin ${userId} verificada com sucesso.`);

            const empresa = await Empresa.findById(empresaId).exec();
            if (!empresa) {
                 throw new AppError('Empresa associada não encontrada.', 404);
            }

            const prefixBase = empresa.nome.substring(0, 4).toLowerCase().replace(/[^a-z]/g, '') || 'emp';
            const uuidPrefix = uuidv4().split('-')[0] || 'key0';
            const newApiKeyPrefix = `${prefixBase}_${uuidPrefix.substring(0, 4)}`;
            const newApiKeySecret = uuidv4();
            const newApiKeyHash = await bcrypt.hash(newApiKeySecret, saltRounds);
            const newFullApiKey = `${newApiKeyPrefix}_${newApiKeySecret}`;

            empresa.api_key_hash = newApiKeyHash;
            empresa.api_key_prefix = newApiKeyPrefix;

            empresa.api_key_history = empresa.api_key_history || [];
            empresa.api_key_history.push({
                regenerated_by: userId,
                regenerated_at: new Date(),
                ip_address: auditData.ip_address || null,
                user_agent: auditData.user_agent || null
            } as any);

            await empresa.save();
            
            logger.info(`[UserService] API Key para empresa ${empresaId} regenerada com sucesso por admin ${userId}.`);

            return {
                fullApiKey: newFullApiKey,
                newPrefix: newApiKeyPrefix
            };
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            logger.error(`[UserService] Erro inesperado ao regenerar API Key para empresa ${empresaId}: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao regenerar chave API: ${error.message}`, 500);
        }
    }
}

export default UserService;



