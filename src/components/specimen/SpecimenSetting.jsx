import React from 'react';
import { specimenConfig } from './specimenConfig.js';

/**
 * SpecimenSetting — Long-form text at 6 decreasing sizes.
 * Demonstrates readability at body-text densities.
 * Mirrors specimen-builder's setting.html container.
 */
export default function SpecimenSetting() {
  const sizeClasses = ['setting-xxxl', 'setting-xxl', 'setting-l', 'setting-m', 'setting-body', 'setting-s'];

  return (
    <div className="specimen-container">
      <section className="specimen-setting">
        {specimenConfig.settings.map((block, i) => (
          <div key={i} className={`specimen-setting__block ${sizeClasses[i] || ''}`}>
            <div className="specimen-setting__label">{block.label}</div>
            <p style={{ margin: '0.4em 0' }}>{block.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
