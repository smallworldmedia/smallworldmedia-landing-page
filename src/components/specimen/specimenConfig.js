/**
 * specimenConfig.js
 *
 * Central data file for the Font Specimen page.
 * Merges specimen-builder's content.js + site.js into a single export.
 *
 * Edit these values to change which font is showcased and what
 * content is displayed in each specimen container.
 */

export const specimenConfig = {
  /* ── Site / Meta ── */
  title: 'TOBEHONEST',
  typeface: 'TOBEHONEST',
  style: 'Bold',
  designers: 'Small World Media',
  foundry: 'Small World Media™',
  year: '2026',
  coverage: 'Latin & Extended Latin',
  about:
    'TOBEHONEST is a custom display typeface designed by Small World Media. Built for impact at scale — heavy, unapologetic, and engineered for bold creative direction across branding, editorial, and motion systems.',
  link: '#',
  direction: 'ltr',

  /* ── Masthead ── */
  poster: 'TOBEHONEST',

  /* ── Tester ── */
  tester:
    'Just keep examining every low bid quoted for zinc etchings.',

  /* ── Specimen showcase — escalating size/weight combos ── */
  specimen: [
    { text: 'HONESTY', className: 'specimen-8xl' },
    { text: 'Brutalism', className: 'specimen-6xl' },
    { text: 'Visual Identity & Motion Systems', className: 'specimen-3xl' },
    {
      text: 'Building worlds from rhythm, light, and form — where sound meets surface',
      className: 'specimen-xl',
    },
  ],

  /* ── Setting — long-form text at decreasing sizes ── */
  settings: [
    {
      label: 'xxxl',
      text: 'Everyone has the right to life',
    },
    {
      label: 'xxl',
      text: 'All human beings are born free and equal in dignity and rights.',
    },
    {
      label: 'l',
      text: 'They are endowed with reason and conscience and should act towards one another in a spirit of brotherhood. Everyone is entitled to all the rights and freedoms set forth in this Declaration, without distinction of any kind.',
    },
    {
      label: 'm',
      text: 'Everyone has the right to life, liberty and security of person. No one shall be held in slavery or servitude; slavery and the slave trade shall be prohibited in all their forms. No one shall be subjected to torture or to cruel, inhuman or degrading treatment or punishment.',
    },
    {
      label: 'body',
      text: 'Everyone has the right to recognition everywhere as a person before the law. All are equal before the law and are entitled without any discrimination to equal protection of the law. All are entitled to equal protection against any discrimination in violation of this Declaration and against any incitement to such discrimination.',
    },
    {
      label: 's',
      text: 'Everyone has the right to an effective remedy by the competent national tribunals for acts violating the fundamental rights granted him by the constitution or by law. No one shall be subjected to arbitrary arrest, detention or exile. Everyone is entitled in full equality to a fair and public hearing by an independent and impartial tribunal, in the determination of his rights and obligations and of any criminal charge against him.',
    },
  ],

  /* ── Character grid — curated set ── */
  characters: {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numerals: '0123456789',
    punctuation: '!#$%&()*+,-./;=?@^~',
    extended: 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöøùúûüý',
  },

  /* ── Language coverage ── */
  languages:
    'Afrikaans, Albanian, Basque, Breton, Catalan, Cornish, Croatian, Czech, Danish, Dutch, English, Estonian, Faroese, Finnish, French, Galician, German, Hungarian, Icelandic, Indonesian, Irish, Italian, Latvian, Lithuanian, Luxembourgish, Maltese, Norwegian, Polish, Portuguese, Romanian, Slovak, Slovenian, Spanish, Swedish, Turkish, Welsh',
};
