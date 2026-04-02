import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a healthy backend status payload', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'rbac-visualizer-backend',
    });
  });
});
