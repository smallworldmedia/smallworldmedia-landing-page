import React from 'react';
import { specimenConfig } from './specimenConfig.js';

/**
 * SpecimenShowcase — Display words at escalating sizes.
 * Each line is contentEditable for user exploration.
 * Mirrors specimen-builder's specimen.html container.
 */
export default function SpecimenShowcase() {
  return (
    <div className="specimen-container">
      <section className="specimen-showcase">
        {specimenConfig.specimen.map((item, i) => (
          <div
            key={i}
            className={`specimen-showcase__line ${item.className}`}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
          >
            {item.text}
          </div>
        ))}
      </section>
    </div>
  );
}
