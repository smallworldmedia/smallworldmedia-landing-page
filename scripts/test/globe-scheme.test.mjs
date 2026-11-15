// The home globe's colour scheme (SQ-90): the pure parts. sceneAccent / gapHex decide the lattice, gap and fog
// colour per scheme; nameInks decides a name strip's ground and lettering; a settled scheme change repaints the
// cached strip IN PLACE (TextureManager.recolorNames), so the cache key carries no colour and no strip is stale.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { sceneAccent, gapHex, GAP_COLOR } from '../../src/components/globe/globeConfig.js';
import { nameAsset, nameInks, nameStripPaints, loadNameTexture } from '../../src/components/globe/nameTicker.js';
import TextureManager, { assetKey } from '../../src/components/globe/TextureManager.js';
import { SCHEMES, SPECTRUM } from '../../src/lib/colorScheme.js';

const WORLD = { slug: 'acme', clientName: 'Acme', projectColor: '#fd361a', spectrum: 'green' };
const BARE = { slug: 'bare', clientName: 'Bare' }; // no projectColor, no spectrum key

test('GAP_COLOR resolves to the brand blue the scheme helpers expect', () => {
  assert.equal(`#${GAP_COLOR.toString(16).padStart(6, '0')}`, '#0000ff');
});

test('gapHex: project and blue keep brand blue, black goes black, spectrum takes the palette blue', () => {
  assert.deepEqual(Object.fromEntries(SCHEMES.map((s) => [s, gapHex(s)])), {
    project: '#0000ff',
    black: '#000000',
    blue: '#0000ff',
    spectrum: SPECTRUM.blue.fill,
  });
});

test('sceneAccent: a world with a projectColor and a spectrum key, under each scheme', () => {
  assert.equal(sceneAccent(WORLD, 'project'), '#fd361a'); // today's colour, untouched
  assert.equal(sceneAccent(WORLD, 'black'), '#000000');
  assert.equal(sceneAccent(WORLD, 'blue'), '#0000ff');
  assert.equal(sceneAccent(WORLD, 'spectrum'), SPECTRUM.green.fill);
});

test('sceneAccent: a pool world with no projectColor and no spectrum key (acceptance 4)', () => {
  assert.equal(sceneAccent(BARE, 'project'), '#0000ff'); // today's fallback: the gap blue
  assert.equal(sceneAccent(BARE, 'black'), '#000000');
  assert.equal(sceneAccent(BARE, 'blue'), '#0000ff');
  assert.equal(sceneAccent(BARE, 'spectrum'), '#1556e5'); // the palette blue
});

test('sceneAccent: a projectColor without a spectrum key, and a spectrum key without a projectColor', () => {
  assert.equal(sceneAccent({ projectColor: '#abcdef' }, 'project'), '#abcdef');
  assert.equal(sceneAccent({ projectColor: '#abcdef' }, 'spectrum'), '#1556e5');
  assert.equal(sceneAccent({ spectrum: 'yellow' }, 'project'), '#0000ff');
  assert.equal(sceneAccent({ spectrum: 'yellow' }, 'spectrum'), SPECTRUM.yellow.fill);
  assert.equal(sceneAccent({ projectColor: '#abcdef', spectrum: 'nope' }, 'spectrum'), '#1556e5'); // an unknown key is blue
});

test('sceneAccent: no world (the entrance, ?popcolor 0) is the scheme\'s gap colour', () => {
  for (const s of SCHEMES) {
    assert.equal(sceneAccent(null, s), gapHex(s));
    assert.equal(sceneAccent(undefined, s), gapHex(s));
  }
});

test('nameInks: project is today\'s strips (ink = accent on black, fill = black on accent)', () => {
  assert.deepEqual(nameInks(WORLD, 'ink', 'project'), { ground: '#000000', text: '#fd361a' });
  assert.deepEqual(nameInks(WORLD, 'fill', 'project'), { ground: '#fd361a', text: '#000000' });
  assert.deepEqual(nameInks(BARE, 'ink', 'project'), { ground: '#000000', text: '#0000ff' });
  assert.deepEqual(nameInks(BARE, 'fill', 'project'), { ground: '#0000ff', text: '#000000' });
});

test('nameInks: black is white lettering on black, whichever the style (acceptance 1)', () => {
  for (const style of ['ink', 'fill']) {
    assert.deepEqual(nameInks(WORLD, style, 'black'), { ground: '#000000', text: '#ffffff' });
    assert.deepEqual(nameInks(BARE, style, 'black'), { ground: '#000000', text: '#ffffff' });
  }
});

test('nameInks: blue is every world brand blue; spectrum is the world\'s palette pair', () => {
  assert.deepEqual(nameInks(WORLD, 'ink', 'blue'), { ground: '#000000', text: '#0000ff' });
  assert.deepEqual(nameInks(WORLD, 'fill', 'blue'), { ground: '#0000ff', text: '#000000' });
  assert.deepEqual(nameInks(WORLD, 'ink', 'spectrum'), { ground: '#000000', text: SPECTRUM.green.fill });
  assert.deepEqual(nameInks(WORLD, 'fill', 'spectrum'), { ground: SPECTRUM.green.fill, text: SPECTRUM.green.fg });
  assert.deepEqual(nameInks({ ...WORLD, spectrum: 'red' }, 'fill', 'spectrum'), { ground: SPECTRUM.red.fill, text: SPECTRUM.red.fg });
  assert.deepEqual(nameInks(BARE, 'fill', 'spectrum'), { ground: SPECTRUM.blue.fill, text: SPECTRUM.blue.fg });
});

const LAYOUT = { style: 'ink', size: 0.5, mode: 'region', span: 3, panelAspect: 1 };

test('nameAsset: the cache key carries the drawing but no colour, and the asset carries the world\'s colour inputs', () => {
  const a = nameAsset(WORLD, 0, LAYOUT);
  assert.equal(a.projectColor, '#fd361a');
  assert.equal(a.spectrum, 'green');
  assert.equal(assetKey(a), assetKey(nameAsset({ ...WORLD, projectColor: '#00ff00', spectrum: 'red' }, 0, LAYOUT)));
  assert.notEqual(assetKey(a), assetKey(nameAsset(WORLD, 0, { ...LAYOUT, style: 'fill' }))); // a drawing change still re-keys
});

// A recording canvas: the strip's fills and lettering, in draw order.
function stubCanvas() {
  const log = [];
  const ctx = {
    font: '',
    letterSpacing: '',
    fillStyle: '',
    textBaseline: '',
    measureText: () => ({ width: 40, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 0 }),
    fillRect: () => log.push(['ground', ctx.fillStyle]),
    fillText: (t) => log.push(['text', ctx.fillStyle, t]),
  };
  globalThis.document = {
    fonts: { load: async () => [] },
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };
  return log;
}
const asScheme = (scheme) => {
  globalThis.window = { __swmScheme: { applied: scheme, committed: scheme } };
};
afterEach(() => {
  delete globalThis.document;
  delete globalThis.window;
});

test('loadNameTexture paints the live scheme (acceptance 1: black, white text), and repaints in place', async () => {
  const log = stubCanvas();
  asScheme('black');
  const before = nameStripPaints();
  const tex = await loadNameTexture(nameAsset(WORLD, 0, LAYOUT));
  assert.deepEqual(log, [['ground', '#000000'], ['text', '#ffffff', 'ACME']]);
  assert.equal(tex.userData.scheme, 'black');
  assert.equal(nameStripPaints(), before + 1);
  const version = tex.version;
  log.length = 0;
  tex.userData.repaint('project');
  assert.deepEqual(log, [['ground', '#000000'], ['text', '#fd361a', 'ACME']]);
  assert.equal(tex.userData.scheme, 'project');
  assert.equal(tex.version, version + 1, 'the repaint re-uploads the canvas');
  assert.equal(nameStripPaints(), before + 2);
});

test('TextureManager.recolorNames repaints only the strips not already in the scheme (preview-and-restore costs nothing)', async () => {
  stubCanvas();
  asScheme('project');
  const tm = new TextureManager();
  const strip = nameAsset(WORLD, 0, LAYOUT);
  const other = nameAsset(BARE, 1, { ...LAYOUT, style: 'fill' });
  const [t1, t2] = await Promise.all([tm.loadAsset(strip), tm.loadAsset(other)]);
  const before = nameStripPaints();
  assert.equal(tm.recolorNames('project'), 0, 'already painted for project: nothing to do');
  assert.equal(nameStripPaints(), before);
  assert.equal(tm.recolorNames('black'), 2, 'a settled change repaints every cached strip once');
  assert.equal(nameStripPaints(), before + 2);
  assert.equal(t1.userData.scheme, 'black');
  assert.equal(t2.userData.scheme, 'black');
  assert.equal(tm.recolorNames('black'), 0, 'a second settle on the same scheme is free');
  assert.equal(tm.recolorNames('project'), 2, 'and back');
  assert.equal(tm.cache.size, 2, 'repainting never touches the cache: same keys, same textures');
});
