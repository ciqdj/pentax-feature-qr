// List only firmware-verified feature IDs. A checked model with no verified QR
// features has no digest inputs, and can never borrow another model's codes.
export const FEATURES = Object.freeze([
  Object.freeze({ id: 2, name: '渐变 ND' }),
  Object.freeze({ id: 11, name: '星点自动对焦' }),
  Object.freeze({ id: 14, name: '遥控对焦微动' }),
  Object.freeze({ id: 17, name: '星空影像处理' }),
]);
const k3Features = Object.freeze([28,31,34,37].map((id,i) => Object.freeze({id,name:FEATURES[i].name})));
const none = Object.freeze([]);
export const MODELS = Object.freeze({
  k1ii: Object.freeze({ name: 'K-1 II', modelWord: 78400, filePrefix: 'K1II', features: FEATURES }),
  k1: Object.freeze({ name: 'K-1', modelWord: 77970, filePrefix: 'K1', features: FEATURES }),
  k3iii: Object.freeze({ name: 'K-3 III', label: 'K-3 III（彩色版）', modelWord: 78420, filePrefix: 'K3III', features: k3Features }),
  k3iiim: Object.freeze({ name: 'K-3 III Monochrome', label: 'K-3 III Monochrome（黑白版）', modelWord: 78550, filePrefix: 'K3IIIM', features: k3Features }),
  k70: Object.freeze({ name: 'K-70', firmware: '1.16', features: none }),
  k5iis: Object.freeze({ name: 'K-5 IIs', firmware: '1.07', features: none }),
});
