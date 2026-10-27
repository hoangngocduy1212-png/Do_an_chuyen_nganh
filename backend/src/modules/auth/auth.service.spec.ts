import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const jwt = { sign: jest.fn().mockReturnValue('token') } as unknown as JwtService;

  it('dang ky: bao loi khi email da ton tai', async () => {
    const users: any = { findByEmailWithPassword: jest.fn().mockResolvedValue({ _id: '1' }) };
    const svc = new AuthService(users, jwt);
    await expect(svc.register({ fullName: 'A', email: 'a@a.com', password: '123456' })).rejects.toThrow(ConflictException);
  });

  it('dang nhap: sai mat khau -> 401', async () => {
    const hash = await bcrypt.hash('dung', 10);
    const users: any = { findByEmailWithPassword: jest.fn().mockResolvedValue({ _id: '1', password: hash, status: 'ACTIVE' }) };
    const svc = new AuthService(users, jwt);
    await expect(svc.login({ email: 'a@a.com', password: 'sai' })).rejects.toThrow(UnauthorizedException);
  });

  it('dang nhap dung -> tra ve accessToken', async () => {
    const hash = await bcrypt.hash('dung', 10);
    const users: any = {
      findByEmailWithPassword: jest.fn().mockResolvedValue({ _id: '1', fullName: 'A', email: 'a@a.com', role: 'CUSTOMER', password: hash, status: 'ACTIVE' }),
    };
    const res = await new AuthService(users, jwt).login({ email: 'a@a.com', password: 'dung' });
    expect(res.accessToken).toBe('token');
  });
});
