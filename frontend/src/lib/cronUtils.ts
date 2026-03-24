export type CronType = 'every-n-minutes' | 'every-n-hours' | 'daily' | 'weekly' | 'custom';

export interface CronState {
  type: CronType;
  minuteInterval: number;
  hourInterval: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
  custom: string;
}

function defaultState(custom = '0 * * * *'): CronState {
  return {
    type: 'custom',
    minuteInterval: 30,
    hourInterval: 1,
    hour: 0,
    minute: 0,
    dayOfWeek: 1,
    custom,
  };
}

export function parseCron(expr: string): CronState {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return defaultState(expr);
  const [min, hr, , , dow] = parts;

  if (min.startsWith('*/') && hr === '*') {
    const n = parseInt(min.slice(2));
    if (!isNaN(n)) return { ...defaultState(), type: 'every-n-minutes', minuteInterval: n };
  }
  if (min === '0' && hr.startsWith('*/')) {
    const n = parseInt(hr.slice(2));
    if (!isNaN(n)) return { ...defaultState(), type: 'every-n-hours', hourInterval: n };
  }
  if (dow === '*' && /^\d+$/.test(hr) && /^\d+$/.test(min)) {
    return { ...defaultState(), type: 'daily', hour: parseInt(hr), minute: parseInt(min) };
  }
  if (/^\d+$/.test(dow) && /^\d+$/.test(hr) && /^\d+$/.test(min)) {
    return {
      ...defaultState(),
      type: 'weekly',
      dayOfWeek: parseInt(dow),
      hour: parseInt(hr),
      minute: parseInt(min),
    };
  }
  return defaultState(expr);
}

export function cronToString(state: CronState): string {
  switch (state.type) {
    case 'every-n-minutes':
      return `*/${state.minuteInterval} * * * *`;
    case 'every-n-hours':
      return `0 */${state.hourInterval} * * *`;
    case 'daily':
      return `${state.minute} ${state.hour} * * *`;
    case 'weekly':
      return `${state.minute} ${state.hour} * * ${state.dayOfWeek}`;
    case 'custom':
      return state.custom;
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function describeCron(expr: string): string {
  const state = parseCron(expr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(state.hour)}:${pad(state.minute)}`;
  switch (state.type) {
    case 'every-n-minutes':
      return `Every ${state.minuteInterval} minute${state.minuteInterval !== 1 ? 's' : ''}`;
    case 'every-n-hours':
      return `Every ${state.hourInterval} hour${state.hourInterval !== 1 ? 's' : ''}`;
    case 'daily':
      return `Daily at ${time}`;
    case 'weekly':
      return `${DAY_NAMES[state.dayOfWeek] ?? `Day ${state.dayOfWeek}`} at ${time}`;
    case 'custom':
      return state.custom;
  }
}
