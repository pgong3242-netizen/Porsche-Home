import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/FriendsMap.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function mount() {
  let scope = 'friends';
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => name === 'react'
    ? { ...require('react'), useState: () => [scope, value => { scope = value; }] }
    : require(name), compiledModule, compiledModule.exports);
  return () => compiledModule.exports.default();
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}

test('weekly mileage switches from thirteen friends to a descending world ranking', () => {
  const render = mount();
  const list = tree => find(tree, node => node.type === 'ol');
  const friendMarkup = renderToStaticMarkup(list(render()));
  assert.equal((friendMarkup.match(/<li>/g) || []).length, 13);
  assert.match(friendMarkup, /江桥研发中心/);
  assert.match(friendMarkup, /Alpine Sunday/);
  const worldButton = find(render(), node => node.type === 'button' && node.props.children.includes('世界榜'));
  worldButton.props.onClick();
  const worldMarkup = renderToStaticMarkup(list(render()));
  const distances = [...worldMarkup.matchAll(/class="mileage-distance">([\d.]+)/g)].map(match => Number(match[1]));
  assert.equal(distances.length, 16);
  assert.deepEqual(distances, [...distances].sort((a, b) => b - a));
  assert.match(worldMarkup, /km/);
  assert.match(renderToStaticMarkup(render()), /示例里程，尚未接入真实驾驶数据/);
  const friendButton = find(render(), node => node.type === 'button' && node.props.children.includes('好友榜'));
  friendButton.props.onClick();
  assert.equal(renderToStaticMarkup(list(render())), friendMarkup);
});

test('the illustrated map has an accessible title and only Munich as a visitable destination', () => {
  const markup = renderToStaticMarkup(mount()());
  assert.match(markup, /手绘世界好友地图/);
  assert.doesNotMatch(markup, /href="\/\?demo=porsche-rd"/);
  assert.equal((markup.match(/<a /g) || []).length, 1);
  assert.equal((markup.match(/class="map-sample-friend"/g) || []).length, 5);
  assert.match(markup, /其余为示例车友/);
  assert.match(markup, /慕尼黑/);
  assert.match(markup, /src="\/images\/porsche-world-landmarks.webp"/);
  assert.ok(readFileSync(new URL('../public/images/porsche-world-landmarks.webp', import.meta.url)).length > 0);
  assert.match(markup, /href="\/\?demo=munich"/);
  assert.doesNotMatch(markup, /<canvas|插画地图 · 非导航用途|world-tree|world-rock|world-house|world-office|stroke-dasharray/);
});


test('/map renders its own page with links back to the courtyard and garage', () => {
  const route = readFileSync(new URL('../app/map/page.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name === '@/components/FriendsMap'
    ? { default: mount() }
    : require(name), compiledModule, compiledModule.exports);
  const markup = renderToStaticMarkup(compiledModule.exports.default());
  assert.match(markup, /href="\/map"/);
  assert.match(markup, /href="\/\?view=home"/);
  assert.match(markup, /href="\/\?view=workshop"/);
  assert.match(markup, /周里程榜/);
  assert.doesNotMatch(markup, /<header|<canvas/);
});


test('map podium follows the selected ranking and displays its top three distances', () => {
  const render = mount();
  const podium = () => find(render(), node => node.props?.className === 'map-podium');
  const names = () => podium().props.children.map(node => node.props.children[1].props.children[0].props.children);
  assert.deepEqual(names(), ['Alpine Sunday', '晨风 911', '落日巡游']);
  find(render(), node => node.type === 'button' && node.props.children.includes('世界榜')).props.onClick();
  assert.deepEqual(names(), ['Alpine Sunday', 'Coastline 911', 'Forest Drive']);
  assert.match(renderToStaticMarkup(podium()), /176.2 km/);
});
