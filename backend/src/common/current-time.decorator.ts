import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DateTime } from 'luxon';
import { CLINIC_TIMEZONE } from './time.util';

/**
 * Custom decorator to extract the current time.
 * If non-production and 'X-Now' header is present, uses that timestamp.
 * Otherwise defaults to current system time in Asia/Kathmandu.
 */
export const CurrentTime = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const xNowHeader = request.headers['x-now'] || request.headers['X-Now'];

    if (
      process.env.NODE_ENV !== 'production' &&
      xNowHeader &&
      typeof xNowHeader === 'string'
    ) {
      const parsed = DateTime.fromISO(xNowHeader.trim(), { setZone: true });
      if (parsed.isValid) {
        return parsed.setZone(CLINIC_TIMEZONE).toISO()!;
      }
    }

    return DateTime.now().setZone(CLINIC_TIMEZONE).toISO()!;
  },
);
