import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(private readonly config: ConfigService) {
    if (this.config.get<string>('mail.driver') === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('mail.host'),
        port: this.config.get<number>('mail.port'),
        secure: this.config.get<number>('mail.port') === 465,
        auth: {
          user: this.config.get<string>('mail.user'),
          pass: this.config.get<string>('mail.pass'),
        },
      });
    }
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = this.passwordResetTemplate(resetUrl);
    if (!this.transporter) {
      this.logger.log(`MAIL_DRIVER=console; gửi email đặt lại mật khẩu tới ${email}:\n${html}`);
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get<string>('mail.from'),
      to: email,
      subject: 'Đặt lại mật khẩu Muadee',
      html,
    });
  }

  async sendPasswordChanged(email: string): Promise<void> {
    const html = this.passwordChangedTemplate();
    if (!this.transporter) {
      this.logger.log(`MAIL_DRIVER=console; thông báo thay đổi mật khẩu tới ${email}:\n${html}`);
      return;
    }
    await this.transporter.sendMail({
      from: this.config.get<string>('mail.from'),
      to: email,
      subject: 'Mật khẩu Muadee đã được thay đổi',
      html,
    });
  }

  private passwordResetTemplate(resetUrl: string): string {
    return `<div style="font-family:Arial,sans-serif;color:#0F2A24;max-width:560px;margin:0 auto;padding:32px">
      <h1 style="color:#0B7A5E">Muadee</h1><h2>Đặt lại mật khẩu</h2>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
      <p style="margin:28px 0"><a href="${this.escapeAttribute(resetUrl)}" style="background:#0B7A5E;color:white;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Đặt lại mật khẩu</a></p>
      <p>Liên kết hết hạn sau 15 phút.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    </div>`;
  }

  private passwordChangedTemplate(): string {
    return '<div style="font-family:Arial,sans-serif;color:#0F2A24;max-width:560px;margin:0 auto;padding:32px"><h1 style="color:#0B7A5E">Muadee</h1><h2>Mật khẩu đã được thay đổi</h2><p>Mật khẩu của bạn vừa được thay đổi. Nếu bạn không thực hiện thao tác này, vui lòng liên hệ cửa hàng để được hỗ trợ.</p></div>';
  }

  private escapeAttribute(value: string): string {
    return value.replace(/[&"'<>]/g, (character) => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[character] ?? character);
  }
}