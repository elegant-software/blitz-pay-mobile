const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient } = require('@tanstack/react-query');

function loadHook(app, client, fetchProducts, logs) {
  const feature = app === 'blitz-pay' ? 'merchant-catalog' : 'products';
  const filename = path.resolve(__dirname, '../../', app, `src/features/${feature}/hooks/useProductImage.ts`);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  let active;
  const react = {
    useCallback: callback => callback,
    useRef(initial) {
      const index = active.cursor++;
      return active.slots[index] ??= { current: initial };
    },
    useState(initial) {
      const instance = active;
      const index = instance.cursor++;
      if (!(index in instance.slots)) instance.slots[index] = initial;
      return [instance.slots[index], value => { instance.slots[index] = value; }];
    },
  };
  const context = {
    exports: {}, URL,
    require(name) {
      if (name === 'react') return react;
      if (name === '@tanstack/react-query') return { useQueryClient: () => client };
      if (name.includes('observability')) return { observability: {
        info: (...args) => logs.push(args), warn: (...args) => logs.push(args),
      } };
      if (name.includes('merchantCatalogService')) return { fetchCatalogProductDetail: fetchProducts };
      if (name.includes('merchantProducts')) return { fetchProductDetail: fetchProducts };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  return params => {
    const instance = { slots: [], cursor: 0 };
    return (next = params) => {
      active = instance;
      active.cursor = 0;
      return context.exports.useProductImage(next);
    };
  };
}

async function check(app) {
  const client = new QueryClient();
  const logs = [];
  const expired = 'https://storage.example/image.jpg?X-Amz-Signature=expired-secret';
  const renewed = 'https://storage.example/image.jpg?X-Amz-Signature=renewed-secret';
  const renewedThumbnail = 'https://storage.example/thumbnail.jpg?X-Amz-Signature=renewed-secret';
  let calls = 0;
  let fail = false;
  const hook = loadHook(app, client, async (merchantId, branchId, productId) => {
    calls++;
    assert.equal(merchantId, 'merchant');
    assert.equal(branchId, 'branch');
    if (fail) throw new Error('backend unavailable');
    assert(['one', 'two'].includes(productId));
    return { id: productId, productId, branchId, imageUrl: renewed, thumbnailUrl: renewedThumbnail };
  }, logs);
  const params = { merchantId: 'merchant', branchId: 'branch', productId: 'one', imageUrl: expired };
  const first = hook(params);
  const second = hook({ ...params, productId: 'two' });
  assert.equal(first().imageUrl, expired);
  await Promise.all([first().refresh(), first().refresh(), second().refresh()]);
  assert.equal(calls, 2, 'Concurrent failures for one product share a detail request');
  assert.equal(first().imageUrl, renewed);
  assert.equal(second().imageUrl, renewed);
  await first().refresh();
  assert.equal(calls, 2, 'A renewed image failure cannot loop');
  const thumbnail = hook({ ...params, variant: 'thumbnail' });
  await thumbnail().refresh();
  assert.equal(thumbnail().imageUrl, renewedThumbnail, 'List images renew the thumbnail variant');
  assert.equal(first().imageUrl, renewed, 'Detail images retain the larger variant');
  assert.equal(calls, 2, 'Variants reuse the same product-detail response');
  assert.equal(first({ ...params, branchId: 'another-branch' }).imageUrl, expired, 'Old result cannot cross branch scope');
  assert.equal(first({ ...params, imageUrl: 'file:///picked.jpg' }).imageUrl, 'file:///picked.jpg', 'Replacement cannot overwrite a selected local photo');
  await hook({ ...params, imageUrl: 'file:///picked.jpg' })().refresh();
  await hook({ ...params, imageUrl: 'https://storage.example/public.jpg' })().refresh();
  await hook({ ...params, merchantId: undefined })().refresh();
  assert.equal(calls, 2, 'Local, unsigned, and unscoped images do not fetch');

  client.clear();
  const unchanged = hook({ ...params, imageUrl: renewed });
  await unchanged().refresh();
  await unchanged().refresh();
  assert.equal(calls, 3, 'An unchanged backend URL is attempted only once');
  assert.equal(unchanged().imageUrl, renewed);

  client.clear();
  fail = true;
  const failing = hook(params);
  await failing().refresh();
  await failing().refresh();
  assert.equal(calls, 4, 'Backend failures are bounded and handled');
  assert.equal(failing().imageUrl, expired);
  assert(logs.some(([event]) => event === 'product_image_url_refresh_failed'));
  assert(!JSON.stringify(logs).includes('secret'), 'Signed URLs never enter telemetry');
  client.clear();
  console.log(`${app}: image refresh, deduplication, scope, retry limits, and safe logging passed`);
}

(async () => {
  await check('blitz-pay');
  await check('blitz-pay-merchant');
})().catch(error => { console.error(error); process.exitCode = 1; });
