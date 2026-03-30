import { useState } from 'react';
import {
  type CronState,
  type CronType,
  cronToString,
  describeCron,
  parseCron,
} from '../lib/cronUtils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  value: string;
  onChange: (cron: string) => void;
}

export function CronBuilder({ value, onChange }: Props) {
  const [state, setState] = useState<CronState>(() => parseCron(value));

  const update = (partial: Partial<CronState>) => {
    const next = { ...state, ...partial };
    setState(next);
    onChange(cronToString(next));
  };

  const inputCls =
    'rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={state.type}
          onChange={(e) => update({ type: e.target.value as CronType })}
          className={inputCls}
        >
          <option value="every-n-minutes">Every N minutes</option>
          <option value="every-n-hours">Every N hours</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom cron</option>
        </select>

        {state.type === 'every-n-minutes' && (
          <input
            type="number"
            min={1}
            max={59}
            value={state.minuteInterval}
            onChange={(e) => update({ minuteInterval: parseInt(e.target.value, 10) || 1 })}
            className={`w-20 ${inputCls}`}
          />
        )}

        {state.type === 'every-n-hours' && (
          <input
            type="number"
            min={1}
            max={23}
            value={state.hourInterval}
            onChange={(e) => update({ hourInterval: parseInt(e.target.value, 10) || 1 })}
            className={`w-20 ${inputCls}`}
          />
        )}

        {(state.type === 'daily' || state.type === 'weekly') && (
          <input
            type="time"
            value={`${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              update({ hour: h ?? 0, minute: m ?? 0 });
            }}
            className={inputCls}
          />
        )}

        {state.type === 'weekly' && (
          <select
            value={state.dayOfWeek}
            onChange={(e) => update({ dayOfWeek: parseInt(e.target.value, 10) })}
            className={inputCls}
          >
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        )}

        {state.type === 'custom' && (
          <input
            type="text"
            value={state.custom}
            onChange={(e) => update({ custom: e.target.value })}
            placeholder="* * * * *"
            className={`w-36 font-mono ${inputCls}`}
          />
        )}
      </div>
      <p className="text-xs text-gray-400">{describeCron(cronToString(state))}</p>
    </div>
  );
}
