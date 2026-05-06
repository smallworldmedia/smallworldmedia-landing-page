import React, { useState, useRef } from 'react';
import { specimenConfig } from './specimenConfig.js';

/**
 * AlignIcon — Inline SVG alignment icons.
 */
function AlignIcon({ type }) {
  const bars = {
    left: [
      { width: 16, y: 2 },
      { width: 11, y: 6 },
      { width: 14, y: 10 },
      { width: 9, y: 14 },
    ],
    center: [
      { width: 14, x: 1, y: 2 },
      { width: 10, x: 3, y: 6 },
      { width: 16, x: 0, y: 10 },
      { width: 12, x: 2, y: 14 },
    ],
    justify: [
      { width: 16, y: 2 },
      { width: 16, y: 6 },
      { width: 16, y: 10 },
      { width: 16, y: 14 },
    ],
    right: [
      { width: 14, y: 2 },
      { width: 11, y: 6 },
      { width: 16, y: 10 },
      { width: 9, y: 14 },
    ],
  };

  const rects = bars[type] || bars.left;
  return (
    <svg viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
      {rects.map((r, i) => (
        <rect
          key={i}
          x={type === 'right' ? 16 - r.width : r.x || 0}
          y={r.y}
          width={r.width}
          height={1.5}
          rx={0.5}
        />
      ))}
    </svg>
  );
}

/**
 * SpecimenTester — Interactive type tester with live controls.
 * Mirrors specimen-builder's interactive-controls container with SWM styling.
 */
export default function SpecimenTester() {
  const [fontSize, setFontSize] = useState(48);
  const [lineHeight, setLineHeight] = useState(1.1);
  const [align, setAlign] = useState('left');
  const textRef = useRef(null);

  const alignments = ['left', 'center', 'justify', 'right'];

  return (
    <div className="specimen-container">
      <section className="specimen-tester">
        {/* Preview area — editable text */}
        <div className="specimen-tester__preview">
          <div
            ref={textRef}
            className="specimen-tester__text"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              textAlign: align,
            }}
          >
            {specimenConfig.tester}
          </div>
        </div>

        {/* Controls panel */}
        <div className="specimen-tester__controls">
          {/* Size slider */}
          <div className="specimen-tester__control-group">
            <label className="specimen-tester__label">
              Size
              <span className="specimen-tester__label-value">{fontSize}px</span>
            </label>
            <input
              type="range"
              className="specimen-tester__slider"
              min={12}
              max={200}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </div>

          {/* Line height slider */}
          <div className="specimen-tester__control-group">
            <label className="specimen-tester__label">
              Line Height
              <span className="specimen-tester__label-value">{lineHeight.toFixed(2)}</span>
            </label>
            <input
              type="range"
              className="specimen-tester__slider"
              min={0.7}
              max={2.0}
              step={0.05}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
            />
          </div>

          {/* Alignment buttons */}
          <div className="specimen-tester__control-group">
            <span className="specimen-tester__label">Alignment</span>
            <div className="specimen-tester__align-group">
              {alignments.map((a) => (
                <button
                  key={a}
                  className={`specimen-tester__align-btn${
                    align === a ? ' specimen-tester__align-btn--active' : ''
                  }`}
                  onClick={() => setAlign(a)}
                  title={a}
                >
                  <AlignIcon type={a} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
