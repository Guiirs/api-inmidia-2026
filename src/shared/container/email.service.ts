/**
 * Email Service
 * Serviço centralizado para envio de emails
 */

import nodemailer, { Transporter } from 'nodemailer';
import logger from '../container/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PasswordResetEmail {
  email: string;
  resetUrl: string;
  expiresIn: number; // em minutos
}

class EmailService {
  private transporter: Transporter | null = null;

  /**
   * Inicializa o serviço de email
   */
  initialize(): void {
    if (process.env.SMTP_ENABLED !== 'true') {
      logger.warn('[EmailService] ⚠️ SMTP não configurado - emails não serão enviados');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outros
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD || '',
            }
          : undefined,
      });

      logger.info('[EmailService] ✅ Email service initialized');
    } catch (error) {
      logger.error('[EmailService] Erro ao inicializar SMTP', { error });
    }
  }

  /**
   * Envia email genérico
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.warn(`[EmailService] SMTP não configurado. Email não enviado para ${options.to}`);
      return false;
    }

    try {
      const result = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@inmidia.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.subject,
      });

      logger.info(`[EmailService] ✅ Email enviado para ${options.to}`, { messageId: result.messageId });
      return true;
    } catch (error) {
      logger.error(`[EmailService] Erro ao enviar email para ${options.to}`, { error });
      return false;
    }
  }

  /**
   * Envia email de reset de senha
   */
  async sendPasswordResetEmail(data: PasswordResetEmail): Promise<boolean> {
    const html = this.generatePasswordResetHtml(data.resetUrl, data.expiresIn);

    return this.sendEmail({
      to: data.email,
      subject: '🔒 Redefina sua senha - InMidia',
      html,
      text: `Clique no link para redefinir sua senha: ${data.resetUrl}`,
    });
  }

  /**
   * Gera HTML para email de reset de senha
   */
  private generatePasswordResetHtml(resetUrl: string, expiresIn: number): string {
    return `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
          .card { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #1f2937; }
          .content { margin: 20px 0; }
          .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
          .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">🔒 InMidia</div>
            </div>
            
            <h2>Redefina sua senha</h2>
            
            <div class="content">
              <p>Received uma solicitação para redefinir a sua senha. Clique no botão abaixo para continuar:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="button">Redefinir Senha</a>
              </div>
              
              <p>Ou copie este link no seu navegador:</p>
              <p style="word-break: break-all; color: #3b82f6; font-size: 12px;">${resetUrl}</p>
              
              <div class="warning">
                <strong>⏰ Importante:</strong> Este link expira em ${expiresIn} minutos. Se não for usado neste período, terá de solicitar um novo reset.
              </div>
              
              <p><strong>Segurança:</strong> Se não solicitou este reset, pode ignorar este email. A sua senha permanece segura.</p>
            </div>
            
            <div class="footer">
              <p>Este é um email automático. Favor não responda diretamente.</p>
              <p>&copy; ${new Date().getFullYear()} InMidia. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Envia email de confirmação de registro
   */
  async sendWelcomeEmail(email: string, name: string, loginUrl: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Bem-vindo à InMidia, ${name}! 🎉</h2>
          <p>A sua empresa foi registada com sucesso.</p>
          <p><a href="${loginUrl}" class="button">Faça Login</a></p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: '✅ Bem-vindo à InMidia',
      html,
    });
  }
}

export default new EmailService();
