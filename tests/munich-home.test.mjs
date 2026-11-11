import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/hardsurface/DioramaLab.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function mount(props, mounted = false) {
  const state = [];
  let cursor = 0;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'react') return {
      ...require('react'), useEffect() {}, useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }),
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = index === 0 ? mounted : typeof initial === 'function' ? initial() : initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
    };
    if (name === '@/lib/parts-drop') return { PARTS: [{ id: 'engine' }, { id: 'wheels' }], CARD_BACK: '/parts/back.webp' };
    if (name === '@/lib/hardsurface/vehicle') return { CAR: { x: 0, z: 0 } };
    if (name === '@/lib/hardsurface/structures') return { LAMPS: [{ id: 'lamp-1', live: true }, { id: 'lamp-2', live: false }], LABELS: [] };
    if (name === 'three' || name === 'react/jsx-runtime' || name === 'next/link') return require(name);
    return {};
  }, compiledModule, compiledModule.exports);
  return () => { cursor = 0; return compiledModule.exports.default(props); };
}
function find(node, text) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'button' && node.props.children === text) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, text);
    if (match) return match;
  }
}
test('Munich visit hides lab controls and supports focus, lights, postcards and reset', () => {
  let postcards = 0;
  const render = mount({ embedded: true, onPostcard: () => postcards++ });
  const markup = renderToStaticMarkup(render());
  assert.doesNotMatch(markup, /爆炸视图|Phase 1|hs-perf|hs-label|hs-info/);
  find(render(), '看看爱车').props.onClick();
  assert.equal(render().props['data-selected'], 'vehicle-body');
  find(render(), '穹顶之家').props.onClick();
  assert.equal(render().props['data-selected'], 'dome-shell');
  find(render(), '全景').props.onClick();
  assert.equal(render().props['data-selected'], '');
  find(render(), '亮灯').props.onClick();
  assert.ok(find(render(), '熄灯'));
  find(render(), '熄灯').props.onClick();
  assert.ok(find(render(), '亮灯'));
  find(render(), '留张明信片').props.onClick();
  assert.equal(postcards, 1);
});
test('standalone hard-surface preview retains its inspection controls', () => {
  const markup = renderToStaticMarkup(mount({})());
  assert.match(markup, /爆炸视图/);
  assert.match(markup, /Phase 1/);
  assert.doesNotMatch(markup, /留张明信片/);
});

test('visitor canvas renders on demand with native antialiasing; lab keeps its animation loop', () => {
  const visitor = mount({ embedded: true }, true)().props.children[0];
  assert.equal(visitor.props.frameloop, 'demand');
  assert.equal(visitor.props.flat, false);
  assert.equal(visitor.props.gl.antialias, true);
  const lab = mount({}, true)().props.children[0];
  assert.equal(lab.props.frameloop, 'always');
  assert.equal(lab.props.flat, true);
});

test('stealing a face-down demo card grants it once and removes the action', () => {
  const collected = [];
  const render = mount({ embedded: true, parts: ['engine'], onSteal: id => collected.push(id) });
  const steal = find(render(), '偷张卡');
  assert.ok(steal);
  assert.doesNotMatch(renderToStaticMarkup(render()), /wheels|engine\.webp/);
  steal.props.onClick();
  assert.deepEqual(collected, ['wheels']);
  assert.equal(find(render(), '偷张卡'), undefined);
});
