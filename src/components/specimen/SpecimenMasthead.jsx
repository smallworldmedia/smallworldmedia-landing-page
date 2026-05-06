import React from 'react';
import { specimenConfig } from './specimenConfig.js';

/**
 * SpecimenMasthead — Hero section with large evaluative glyphs + typeface metadata.
 * Maps specimen-builder's masthead container to SWM design system.
 */
export default function SpecimenMasthead() {
  const { poster, typeface, style, designers, foundry, year, coverage, about, link } =
    specimenConfig;

  return (
    <div className="specimen-container">
      <section className="specimen-masthead">
        {/* Title area — large poster glyphs */}
        <div className="specimen-masthead__title-area">
          <h1 className="specimen-masthead__poster">{poster}</h1>
        </div>

        {/* Meta area — typeface info */}
        <div className="specimen-masthead__meta-area">
          <div>
            <div className="specimen-masthead__meta-label">Typeface</div>
            <div className="specimen-masthead__meta-value">
              {typeface} {style}
            </div>
          </div>

          <div>
            <div className="specimen-masthead__meta-label">Foundry</div>
            <div className="specimen-masthead__meta-value">{foundry}</div>
          </div>

          <div>
            <div className="specimen-masthead__meta-label">Year</div>
            <div className="specimen-masthead__meta-value">{year}</div>
          </div>

          <div>
            <div className="specimen-masthead__meta-label">Designers</div>
            <div className="specimen-masthead__meta-value">{designers}</div>
          </div>

          <div>
            <div className="specimen-masthead__meta-label">Coverage</div>
            <div className="specimen-masthead__meta-value">{coverage}</div>
          </div>

          <div className="specimen-masthead__about">{about}</div>

          <div>
            <a href={link} className="specimen-masthead__cta">
              Get {typeface}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
