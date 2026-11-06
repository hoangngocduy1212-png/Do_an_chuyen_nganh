import { http, isMockEnabled, unwrapApiResponse } from './client';

export interface CreateEmployeeInput {
  fullName: string;
  email: string;
  phone: string;
  employeeCode: string;
  employeeRole: string;
  storeId: string;
  password: string;
}

export interface CreatedEmployee {
  userId: string;
  employeeId: string;
  fullName: string;
  email: string;
  employeeCode: string;
  employeeRole: string;
  storeId: string;
}

export const employeesApi = {
  create: async (input: CreateEmployeeInput): Promise<CreatedEmployee> => {
    if (isMockEnabled) throw new Error('Tắt chế độ mock để tạo tài khoản nhân viên thật.');
    return http.post<{ success: true; data: CreatedEmployee }>('/employees', input).then(unwrapApiResponse);
  },
};
