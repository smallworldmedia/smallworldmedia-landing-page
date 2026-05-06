import React, { useState } from 'react';
import { specimenConfig } from './specimenConfig.js';

/**
 * SpecimenCharGrid — Categorised character grid with large preview.
 * Click or hover a glyph to see it enlarged.
 * Mirrors specimen-builder's character-grid container.
 */
export default function SpecimenCharGrid() {
  const [activeGlyph, setActiveGlyph] = useState('A');
  const [activeCategory, setActiveCategory] = useState('uppercase');

  const categories = Object.entries(specimenConfig.characters);

  return (
    <div className="specimen-container">
      <section className="specimen-chargrid">
        <div className="specimen-chargrid__layout">
          {/* Left — sticky preview */}
          <div className="specimen-chargrid__preview">
            <div className="specimen-chargrid__preview-glyph">{activeGlyph}</div>
            <div className="specimen-chargrid__preview-label">
              U+{activeGlyph.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}
              {' · '}
              {activeCategory}
            </div>
          </div>

          {/* Right — character sections */}
          <div>
            {categories.map(([category, chars]) => (
              <div key={category} className="specimen-chargrid__section">
                <h3 className="specimen-chargrid__heading">{category}</h3>
                <div className="specimen-chargrid__grid">
                  {Array.from(chars).map((char, i) => (
                    <div
                      key={`${category}-${i}`}
                      className="specimen-chargrid__cell"
                      onMouseEnter={() => {
                        setActiveGlyph(char);
                        setActiveCategory(category);
                      }}
                      onClick={() => {
                        setActiveGlyph(char);
                        setActiveCategory(category);
                      }}
                    >
                      {char}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
