import { generateCodes } from './core.js';

self.onmessage = async ({ data }) => {
  try {
    const result = await generateCodes(data.serial, (done, total) => {
      self.postMessage({ type: 'progress', done, total });
    }, data.modelId);
    self.postMessage({ type: 'complete', result });
  } catch {
    self.postMessage({ type: 'error' });
  }
};
