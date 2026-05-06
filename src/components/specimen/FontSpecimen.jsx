import React, { useState, useEffect } from 'react';
import { specimenConfig } from './specimenConfig.js';
import SpecimenMasthead from './SpecimenMasthead.jsx';
import SpecimenTester from './SpecimenTester.jsx';
import SpecimenShowcase from './SpecimenShowcase.jsx';
import SpecimenSetting from './SpecimenSetting.jsx';
import SpecimenCharGrid from './SpecimenCharGrid.jsx';

/**
 * FontSpecimen — Main orchestrator component.
 *
 * Vertically stacks all specimen containers, manages
 * dark/light mode toggle, and provides the page navigation.
 */
export default function FontSpecimen() {
  const [mode, setMode] = useState('dark'); // 'dark' = blue bg, 'light' = cream bg

  // Override global overflow:hidden so the specimen page can scroll
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const overrides = [
      ['overflow', 'auto'],
      ['height', 'auto'],
      ['overscroll-behavior', 'auto'],
    ];
    overrides.forEach(([prop, val]) => {
      html.style.setProperty(prop, val, 'important');
      body.style.setProperty(prop, val, 'important');
    });
    return () => {
      overrides.forEach(([prop]) => {
        html.style.removeProperty(prop);
        body.style.removeProperty(prop);
      });
    };
  }, []);

  const toggleMode = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="specimen-page" data-mode={mode}>
      {/* Navigation */}
      <nav className="specimen-nav">
        <a href="/" className="specimen-nav__home">
          ← Small World Media
        </a>
        <button className="specimen-nav__toggle" onClick={toggleMode}>
          <span className="specimen-nav__toggle-dot" />
          {mode === 'dark' ? 'Light' : 'Dark'}
        </button>
      </nav>

      {/* 1. Masthead — large glyphs + typeface meta */}
      <SpecimenMasthead />

      {/* 2. Interactive Tester — editable text with controls */}
      <SpecimenTester />

      {/* 3. Showcase — display words at escalating sizes */}
      <SpecimenShowcase />

      {/* 4. Setting — long-form text at various densities */}
      <SpecimenSetting />

      {/* 5. Character Grid — categorised glyphs with preview */}
      <SpecimenCharGrid />

      {/* 6. Language coverage */}
      <div className="specimen-container">
        <section className="specimen-languages">
          <div className="specimen-meta" style={{ marginBottom: '0.5rem' }}>
            Language Coverage
          </div>
          <div className="specimen-languages__list">
            {specimenConfig.languages}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="specimen-container">
        <footer className="specimen-footer">
          <span className="specimen-footer__text">
            {specimenConfig.typeface} · {specimenConfig.foundry} · {specimenConfig.year}
          </span>
          <a href="/" className="specimen-footer__link specimen-footer__text">
            smallworldmedia.com
          </a>
        </footer>
      </div>
    </div>
  );
}
