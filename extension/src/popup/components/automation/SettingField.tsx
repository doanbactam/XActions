// Renders one settings input based on a SettingFieldDef — replaces the
// hand-written <label>/<input> pairs per automation card in the old markup.
// by nichxbt

import { Checkbox } from '@base-ui/react/checkbox';
import { Select } from '@base-ui/react/select';
import { Slider } from '@base-ui/react/slider';
import type { SettingFieldDef } from '../../types';
import { parseListInput } from '../../lib/format';

interface SettingFieldProps {
  field: SettingFieldDef;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

const SPEED_PRESETS = [
  { speed: 'safe', min: 3000, label: 'Safe' },
  { speed: 'normal', min: 2000, label: 'Normal' },
  { speed: 'fast', min: 1000, label: 'Fast' },
];

export function SettingField({ field, value, onChange }: SettingFieldProps) {
  if (field.type === 'checkbox') {
    return (
      <label className="xa-checkbox-label">
        <Checkbox.Root
          checked={!!value}
          onCheckedChange={(v) => onChange(field.key, !!v)}
          className="xa-checkbox"
        >
          <Checkbox.Indicator className="xa-checkbox-indicator">✓</Checkbox.Indicator>
        </Checkbox.Root>
        {field.label}
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="xa-field">
        <span className="xa-field-label">{field.label}</span>
        <Select.Root value={value as string} onValueChange={(v) => onChange(field.key, v)}>
          <Select.Trigger className="xa-select-trigger">
            <Select.Value />
            <Select.Icon className="xa-select-icon">▾</Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner className="xa-select-positioner">
              <Select.Popup className="xa-select-popup">
                {field.options?.map((opt) => (
                  <Select.Item key={opt.value} value={opt.value} className="xa-select-item">
                    <Select.ItemText>{opt.label}</Select.ItemText>
                    <Select.ItemIndicator className="xa-select-item-indicator">✓</Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </label>
    );
  }

  if (field.type === 'delay') {
    const minMs = Number(value ?? field.default);
    const maxMs = Math.round(minMs * 2.5);
    return (
      <label className="xa-field">
        <span className="xa-field-label">
          {field.label} <small className="xa-field-hint">{(minMs / 1000).toFixed(1)}s — {(maxMs / 1000).toFixed(1)}s</small>
        </span>
        <div className="xa-speed-presets" role="group" aria-label="Speed presets">
          {SPEED_PRESETS.map((p) => (
            <button
              key={p.speed}
              type="button"
              className={`xa-speed-btn ${minMs === p.min ? 'is-active' : ''}`}
              onClick={() => onChange(field.key, p.min)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Slider.Root
          value={minMs}
          min={field.min ?? 500}
          max={field.max ?? 10000}
          step={field.step ?? 500}
          onValueChange={(v) => onChange(field.key, Array.isArray(v) ? v[0] : v)}
          className="xa-slider-root"
        >
          <Slider.Control className="xa-slider-control">
            <Slider.Track className="xa-slider-track">
              <Slider.Indicator className="xa-slider-indicator" />
              <Slider.Thumb className="xa-slider-thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      </label>
    );
  }

  if (field.type === 'tags') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <label className="xa-field">
        <span className="xa-field-label">
          {field.label} {field.hint && <small className="xa-field-hint">{field.hint}</small>}
        </span>
        <input
          type="text"
          className="xa-input"
          placeholder={field.placeholder}
          defaultValue={arr.join(', ')}
          onBlur={(e) => onChange(field.key, parseListInput(e.target.value))}
        />
      </label>
    );
  }

  if (field.type === 'number') {
    return (
      <label className="xa-field">
        <span className="xa-field-label">{field.label}</span>
        <input
          type="number"
          className="xa-input"
          min={field.min}
          max={field.max}
          value={value as number}
          onChange={(e) => onChange(field.key, parseInt(e.target.value, 10) || 0)}
        />
      </label>
    );
  }

  return (
    <label className="xa-field">
      <span className="xa-field-label">{field.label}</span>
      <input
        type="text"
        className="xa-input"
        placeholder={field.placeholder}
        value={value as string}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    </label>
  );
}
